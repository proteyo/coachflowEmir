"""Attendance streaks depend on explicit attendance marks, never workout completion."""
def attendance_stats(records):
    current = best = attended = missed = 0
    last = None
    for record in sorted(records, key=lambda item: item.date):
        if record.status == "attended":
            current += 1
            attended += 1
            best = max(best, current)
            last = record.date
        elif record.status == "missed":
            current = 0
            missed += 1
    return {"currentStreak": current, "bestStreak": best, "attended": attended, "missed": missed, "lastActivityDate": last}
