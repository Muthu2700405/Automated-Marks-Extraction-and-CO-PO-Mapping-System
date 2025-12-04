import os, re, json, pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("AIzaSyCJq4JSJxIPY4BhSZa7uLHCosLaSHATtj8"))
model = genai.GenerativeModel("gemini-2.5-flash")

def extract_exam_data(image_path: str, output_excel: str = None):
    prompt = """
    You are an OCR assistant.
    From this exam image extract:
    - Register Number
    - Course Code
    - Course Title
    - Semester
    - Exam Date
    - Invigilator Name
    - Marks Table (Q.No, CO, Marks Awarded)
    Return only valid JSON like:
    {
      "Register Number": "...",
      "Course Code": "...",
      "Course Title": "...",
      "Semester": "...",
      "Exam Date": "...",
      "Invigilator Name": "...",
      "Marks": [{"Q.No": "...", "CO": "...", "Marks Awarded": "..."}]
    }
    """
    try:
        response = model.generate_content(
            contents=[
                {"role": "user", "parts": [
                    {"mime_type": "image/png", "data": open(image_path, "rb").read()},
                    {"text": prompt}
                ]}
            ]
        )
    except Exception as e:
        print(f"Gemini API error: {e}")
        return None

    try:
        json_str = re.search(r"\{.*\}", response.text, re.DOTALL).group()
        data = json.loads(json_str)
    except Exception:
        print("Could not parse JSON. Raw output:\n", response.text)
        return None

    if output_excel:
        meta_fields = ["Register Number", "Course Code", "Course Title",
                       "Semester", "Exam Date", "Invigilator Name"]
        meta_df = pd.DataFrame([{k: data.get(k, "") for k in meta_fields}])
        marks_df = pd.DataFrame(data.get("Marks", []))
        with pd.ExcelWriter(output_excel) as w:
            meta_df.to_excel(w, sheet_name="Metadata", index=False)
            marks_df.to_excel(w, sheet_name="Marks Table", index=False)

    return data
