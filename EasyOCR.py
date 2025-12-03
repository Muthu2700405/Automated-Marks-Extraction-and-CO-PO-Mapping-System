import easyocr

reader = easyocr.Reader(['en'])
results = reader.readtext(r'C:\Users\MUTHUKUMARAVEL K\OneDrive\Desktop\sampleAnsScript.jpg')

for (bbox, text, confidence) in results:
    print(f"Detected Text: {text} (Confidence: {confidence:.2f})")

import cv2
from matplotlib import pyplot as plt

image = cv2.imread(r'C:\Users\MUTHUKUMARAVEL K\OneDrive\Desktop\sampleAnsScript.jpg')
for (bbox, text, prob) in results:
    (top_left, top_right, bottom_right, bottom_left) = bbox
    top_left = tuple(map(int, top_left))
    bottom_right = tuple(map(int, bottom_right))
    cv2.rectangle(image, top_left, bottom_right, (0, 255, 0), 2)
    cv2.putText(image, text, top_left, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,0,0), 2)

plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
plt.show()


