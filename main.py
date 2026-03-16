import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import anthropic

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def load_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else []

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

class BookingRequest(BaseModel):
    doctor_id: str
    patient_name: str
    patient_email: str
    patient_phone: str
    appointment_date: str
    appointment_time: str
    notes: str = ""

@app.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/book", response_class=HTMLResponse)
async def booking_page(request: Request):
    return templates.TemplateResponse("booking.html", {"request": request})

@app.get("/api/doctors")
async def get_doctors():
    doctors = load_json("data/doctors.json", [])
    return {"doctors": doctors}

@app.get("/api/availability/{doctor_id}")
async def get_availability(doctor_id: str):
    doctors = load_json("data/doctors.json", [])
    doctor = next((d for d in doctors if d["id"] == doctor_id), None)
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Generate next 7 days of availability
    availability = []
    start_date = datetime.now()
    
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.strftime("%Y-%m-%d")
        
        # Skip weekends for this demo
        if current_date.weekday() >= 5:
            continue
            
        # Generate time slots based on doctor's schedule
        slots = []
        for hour in range(9, 17):  # 9 AM to 5 PM
            for minute in [0, 30]:  # 30-minute slots
                if hour == 16 and minute == 30:  # Don't go past 5 PM
                    break
                slot_time = f"{hour:02d}:{minute:02d}"
                
                # Check if slot is booked
                bookings = load_json("data/bookings.json", [])
                is_booked = any(
                    b["doctor_id"] == doctor_id and 
                    b["appointment_date"] == date_str and 
                    b["appointment_time"] == slot_time 
                    for b in bookings
                )
                
                if not is_booked:
                    slots.append(slot_time)
        
        if slots:
            availability.append({
                "date": date_str,
                "slots": slots
            })
    
    return {"availability": availability, "timezone": doctor["timezone"]}

@app.post("/api/book-appointment")
async def book_appointment(booking: BookingRequest):
    try:
        # Generate booking ID
        booking_id = str(uuid.uuid4())
        
        # Load existing bookings
        bookings = load_json("data/bookings.json", [])
        
        # Check for conflicts
        existing = any(
            b["doctor_id"] == booking.doctor_id and 
            b["appointment_date"] == booking.appointment_date and 
            b["appointment_time"] == booking.appointment_time
            for b in bookings
        )
        
        if existing:
            raise HTTPException(status_code=409, detail="Time slot no longer available")
        
        # Get doctor info for AI confirmation
        doctors = load_json("data/doctors.json", [])
        doctor = next((d for d in doctors if d["id"] == booking.doctor_id), None)
        
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        # Generate AI confirmation message
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        
        prompt = f"""Generate a personalized appointment confirmation message for:
        
Patient: {booking.patient_name}
Doctor: {doctor["name"]} - {doctor["specialty"]}
Date: {booking.appointment_date}
Time: {booking.appointment_time} {doctor["timezone"]}
Patient Notes: {booking.notes}

Include doctor expertise, preparation instructions, and next steps in a warm, professional medical tone."""
        
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
            max_tokens=1000,
            system="You are a medical appointment confirmation system. Generate personalized, professional confirmation messages that include relevant preparation instructions and next steps based on the doctor's specialty.",
            messages=[{"role": "user", "content": prompt}],
        )
        
        confirmation_message = msg.content[0].text
        
        # Save booking
        new_booking = {
            "id": booking_id,
            "doctor_id": booking.doctor_id,
            "patient_name": booking.patient_name,
            "patient_email": booking.patient_email,
            "patient_phone": booking.patient_phone,
            "appointment_date": booking.appointment_date,
            "appointment_time": booking.appointment_time,
            "notes": booking.notes,
            "status": "confirmed",
            "confirmation_message": confirmation_message,
            "created_at": datetime.now().isoformat()
        }
        
        bookings.append(new_booking)
        save_json("data/bookings.json", bookings)
        
        return {"booking_id": booking_id, "status": "confirmed"}
        
    except Exception as e:
        if "api_key" in str(e).lower():
            raise HTTPException(status_code=500, detail="AI service unavailable")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/confirmation/{booking_id}", response_class=HTMLResponse)
async def confirmation_page(request: Request, booking_id: str):
    bookings = load_json("data/bookings.json", [])
    booking = next((b for b in bookings if b["id"] == booking_id), None)
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get doctor info
    doctors = load_json("data/doctors.json", [])
    doctor = next((d for d in doctors if d["id"] == booking["doctor_id"]), None)
    
    return templates.TemplateResponse("confirmation.html", {
        "request": request,
        "booking": booking,
        "doctor": doctor
    })

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)