import os
import json
import requests
from bs4 import BeautifulSoup

def main():
    # Keep these in GitHub Actions Repository Secrets / Variables
    program = os.getenv("PROGRAM", "74")
    section = os.getenv("SECTION", "1")
    semester = os.getenv("SEMESTER", "6th Semester Fa-2026 / Sp-2024")

    url_login = "https://timetable.lgu.edu.pk/index.php"
    url_timetable = "https://timetable.lgu.edu.pk/Semesters/semester_info/SEMESTER_TIMETABLE.php"
    
    with requests.Session() as session:
        print("Authenticating...")
        session.post(url_login, data={"login-btn": ""})
        
        print("Fetching timetable...")
        payload = {
            "program": program,
            "section": section,
            "semester": semester
        }
        response = session.post(url_timetable, data=payload)
        
        soup = BeautifulSoup(response.text, "html.parser")
        table = soup.find("table", {"id": "table-time"})
        
        timetable = {
            "Monday": [], "Tuesday": [], "Wednesday": [], 
            "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []
        }
        
        if not table:
            print("Table not found!")
            return
            
        for row in table.find_all("tr")[2:]:
            day_th = row.find("th")
            if not day_th: continue
            day = day_th.text.strip()
            
            for td in row.find_all("td"):
                text = td.get_text(separator="\n").strip()
                if text == "X" or "All slots are free" in text:
                    continue
                
                lines = [line.strip() for line in text.split("\n") if line.strip()]
                if len(lines) >= 5:
                    subject = lines[0]
                    room = lines[1]
                    teacher = lines[2]
                    time_str = lines[4]
                    
                    try:
                        start, end = time_str.split(" - ")
                        timetable[day].append({
                            "subject": subject,
                            "room": room,
                            "teacher": teacher,
                            "start": start,
                            "end": end
                        })
                    except Exception as e:
                        print(f"Failed to parse time {time_str}: {e}")
                        
        print("Saving to timetable.json...")
        with open("timetable.json", "w", encoding="utf-8") as f:
            json.dump(timetable, f, indent=2)

if __name__ == "__main__":
    main()
