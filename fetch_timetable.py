import os
import json
import requests
from bs4 import BeautifulSoup

def main():
    # Keep these in GitHub Actions Repository Secrets / Variables
    program = os.getenv("PROGRAM")
    section = os.getenv("SECTION")
    semester = os.getenv("SEMESTER")

    url_login = "https://timetable.lgu.edu.pk/index.php"
    url_timetable = "https://timetable.lgu.edu.pk/Semesters/semester_info/SEMESTER_TIMETABLE.php"
    
    with requests.Session() as session:
        session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"})
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
            print("FAILED TO FIND TABLE! HTML Response:")
            print(response.text[:1500])
            raise Exception("Timetable table not found in the HTML response!")
            
        for row in table.find_all("tr")[1:]:
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
