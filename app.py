import os
import re
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from gemini_extractor import extract_exam_data

# ---------- CONFIG ----------
UPLOAD_FOLDER = "uploads"
RESULTS_FOLDER = "results"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)


# ---------- SUBJECT DETECTION ----------
def infer_subject_from_extracted_details(extracted_course_title=None, extracted_course_code=None):
    """Derive subject code and title only from Gemini OCR extracted details."""
    subject_code, subject_title = "UNKNOWN", "Unknown Title"

    if extracted_course_code and isinstance(extracted_course_code, str):
        subject_code = extracted_course_code.strip().upper()

    if extracted_course_title and isinstance(extracted_course_title, str):
        text = extracted_course_title.strip().upper()
        match = re.search(r"\b([0-9]{2,4}[A-Z]{2,4}\d{2,4}|[A-Z]{2,4}\d{2,4})\b", text)
        if match:
            subject_code = match.group(1).replace(" ", "")
            subject_title = re.sub(r"^.*?-\s*", "", text).strip().upper()
        else:
            subject_title = text

    normalized = f"{subject_code}_{subject_title.replace(' ', '_')}"
    return subject_code, subject_title, normalized


# ---------- ROUTES ----------
@app.route("/")
def index_page():
    return render_template("index.html")


@app.route("/new_extraction")
def new_extraction_page():
    return render_template("new_extraction.html")


# ---------- PROCESS ANSWER SCRIPTS ----------
@app.route("/process", methods=["POST"])
def process_files_route():
    try:
        if "rubric" not in request.files or not request.files.getlist("scripts"):
            return jsonify({"error": "Rubric or script files missing."}), 400

        rubric_file = request.files["rubric"]
        script_files = request.files.getlist("scripts")

        # --- Load Rubric File ---
        try:
            rubric_file.seek(0)
            rubric_df = pd.read_excel(rubric_file) if rubric_file.filename.endswith(('.xlsx', '.xls')) else pd.read_csv(rubric_file)
            rubric_df.columns = rubric_df.columns.str.strip()
        except Exception as e:
            return jsonify({"error": f"Invalid rubric file: {e}"}), 400

        all_results = []
        extracted_course_title = None
        extracted_course_code = None

        for script in script_files:
            img_path = os.path.join(UPLOAD_FOLDER, script.filename)
            script.save(img_path)
            print(f"🔍 Processing {img_path} ...")

            data = extract_exam_data(img_path, output_excel=None)
            os.remove(img_path)

            if not data:
                print(f"⚠️ No data extracted from {script.filename}")
                continue

            if not extracted_course_title and data.get("Course Title"):
                extracted_course_title = data.get("Course Title")
            if not extracted_course_code and data.get("Course Code"):
                extracted_course_code = data.get("Course Code")

            meta = {k: data.get(k, "") for k in [
                "Register Number", "Course Code", "Course Title",
                "Semester", "Exam Date", "Invigilator Name"
            ]}
            marks = data.get("Marks", [])

            # ---------- CO Attainment ----------
            co_marks = {}
            co_max = {}

            # Auto-detect column names
            qno_col = next((col for col in rubric_df.columns if str(col).strip().lower() in
                           ["q.no", "qno", "question", "question no", "question number"]), None)
            co_col = next((col for col in rubric_df.columns if str(col).strip().lower() == "co"), None)
            max_col = next((col for col in rubric_df.columns if "max" in str(col).lower()), None)

            if not qno_col or not co_col or not max_col:
                raise KeyError("Rubric file must contain columns for question number (Q.No), CO, and Max Marks.")

            for row in marks:
                qno = str(row.get("Q.No", "")).strip()
                awarded = float(row.get("Marks Awarded", 0))
                rubric_row = rubric_df[rubric_df[qno_col].astype(str).str.strip().eq(qno)]

                if not rubric_row.empty:
                    co = rubric_row.iloc[0][co_col]
                    max_marks = float(rubric_row.iloc[0][max_col])
                    co_marks[co] = co_marks.get(co, 0) + awarded
                    co_max[co] = co_max.get(co, 0) + max_marks

                row.update(meta)
                all_results.append(row)

            co_percent = {co: round((co_marks[co] / co_max[co]) * 100, 2) if co_max[co] else 0 for co in co_marks}

            # ---------- PO Attainment ----------
            po_cols = [c for c in rubric_df.columns if c.strip().upper().startswith("PO")]
            po_attainment = {}
            if po_cols:
                for po in po_cols:
                    related_cos = rubric_df.loc[rubric_df[po] == 1, co_col].unique()
                    if len(related_cos) == 0:
                        continue
                    po_avg = sum(co_percent.get(co, 0) for co in related_cos) / len(related_cos)
                    po_attainment[po] = round(po_avg, 2)

            # ---------- Summary ----------
            all_results.append({
                **meta,
                "Summary Type": "CO-PO Attainment",
                "CO Attainment (%)": str(co_percent),
                "PO Attainment (%)": str(po_attainment)
            })

        if not all_results:
            return jsonify({"error": "No data extracted from uploaded scripts."}), 500

        subject_code, subject_title, subject_name = infer_subject_from_extracted_details(
            extracted_course_title, extracted_course_code
        )
        print(f"📘 Detected Subject: {subject_code} - {subject_title}")

        # Sanitize filename
        safe_name = re.sub(r'[^A-Z0-9_]', '', subject_name.upper())
        excel_path = os.path.join(RESULTS_FOLDER, f"{safe_name}.xlsx")

        # Merge existing results
        new_df = pd.DataFrame(all_results)
        if os.path.exists(excel_path):
            try:
                existing_df = pd.read_excel(excel_path)
                combined_df = pd.concat([existing_df, new_df], ignore_index=True)
                combined_df.drop_duplicates(subset=["Register Number", "Q.No"], keep="last", inplace=True)
            except Exception as e:
                print(f"⚠️ Could not merge existing data: {e}")
                combined_df = new_df
        else:
            combined_df = new_df

        combined_df.to_excel(excel_path, index=False)
        print(f"✅ Saved: {excel_path}")

        return jsonify({
            "status": "success",
            "message": f"{len(script_files)} script(s) processed successfully.",
            "subject_code": subject_code,
            "subject_title": subject_title
        })

    except Exception as e:
        print(f"❌ SERVER ERROR: {e}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500


# ---------- FETCH RESULTS ----------
@app.route("/results/<subject_name>")
def get_results_route(subject_name):
    """Return Excel data as JSON for modal view."""
    try:
        safe_name = re.sub(r'[^A-Z0-9_]', '', subject_name.upper())
        excel_path = os.path.join(RESULTS_FOLDER, f"{safe_name}.xlsx")

        if not os.path.exists(excel_path):
            for file in os.listdir(RESULTS_FOLDER):
                if file.lower().startswith(subject_name.lower()) and file.endswith(".xlsx"):
                    excel_path = os.path.join(RESULTS_FOLDER, file)
                    break

        if not os.path.exists(excel_path):
            return jsonify({"error": "No results file found for this subject."}), 404

        try:
            df = pd.read_excel(excel_path)
            # ✅ Sanitize DataFrame before returning JSON
            df = df.fillna("")
            df = df.replace({float("inf"): "", float("-inf"): ""}, regex=False)
            for col in df.columns:
                df[col] = df[col].apply(lambda x: str(x) if isinstance(x, dict) else x)
            return jsonify(df.to_dict("records"))

        except Exception as e:
            print(f"⚠️ Error reading Excel ({excel_path}): {e}")
            return jsonify({"error": f"Failed to read Excel file: {str(e)}"}), 500

    except Exception as e:
        print(f"❌ Unexpected error in /results/{subject_name}: {e}")
        return jsonify({"error": f"Unexpected server error: {str(e)}"}), 500


# ---------- LIST SUBJECTS ----------
@app.route("/list_subjects")
def list_subjects():
    """List all available result files, marking corrupted ones."""
    subjects = []
    for file in os.listdir(RESULTS_FOLDER):
        if not file.endswith(".xlsx"):
            continue

        name = os.path.splitext(file)[0]
        parts = name.split("_", 1)
        subject_code = parts[0]
        subject_title = parts[1].replace("_", " ") if len(parts) > 1 else "Unknown Title"

        file_path = os.path.join(RESULTS_FOLDER, file)
        status = "Completed"

        try:
            pd.read_excel(file_path, nrows=1)
        except Exception as e:
            print(f"⚠️ Corrupted Excel detected: {file} — {e}")
            status = "Corrupted"

        subjects.append({
            "subjectCode": subject_code,
            "subjectTitle": subject_title,
            "fileName": name,
            "status": status
        })

    subjects_sorted = sorted(subjects, key=lambda x: x["subjectCode"])
    return jsonify(subjects_sorted)


# ---------- CLEAR ALL RESULTS ----------
@app.route("/clear_results", methods=["POST"])
def clear_results():
    deleted = 0
    for file in os.listdir(RESULTS_FOLDER):
        if file.endswith(".xlsx"):
            os.remove(os.path.join(RESULTS_FOLDER, file))
            deleted += 1
    return jsonify({"status": "success", "deleted": deleted})


if __name__ == "__main__":
    app.run(debug=True, port=5000)