def get_ordinal_suffix(rank):
    """Generates ordinal suffixes for ranks (1 -> 1st, 2 -> 2nd, etc.)."""
    if 11 <= rank % 100 <= 13:
        return f"{rank}th"
    suffix = {1: "st", 2: "nd", 3: "rd"}.get(rank % 10, "th")
    return f"{rank}{suffix}"

def calculate_grade(total):
    """Calculates letter grade based on overall total out of 100."""
    if total > 79:
        return "HP", "HIGHLY PROFICIENT"
    elif total > 67:
        return "P", "PROFICIENT"
    elif total > 53:
        return "AP", "APPROACHING PROFICIENCY"
    elif total > 39:
        return "D", "DEVELOPING"
    else:
        return "E", "EMERGING"

def compute_positions_and_ranks(db):
    """Computes subject totals, grades, ranks, overall totals, and class-wide ranks

    for all students, mirroring the Excel formulas.
    """
    students = db.get("students", [])
    grades_store = db.get("grades", {})
    
    subjects = [
        "English Language", "Mathematics", "Science", "Career Technology", 
        "Social Studies", "Computing", "Religious and Moral Education", 
        "Ghanaian Language", "Creative Arts & Design"
    ]
    
    subj_sheet_map = {
        "English Language": "ENG. LANG.",
        "Mathematics": "MATHS",
        "Science": "SCIENCE",
        "Career Technology": "C. TECH",
        "Social Studies": "SOCIAL",
        "Computing": "COMPUTING",
        "Religious and Moral Education": "RME",
        "Ghanaian Language": "GH. LANG.",
        "Creative Arts & Design": "C. ARTS"
    }
    
    # Initialize score map per student
    student_scores = {s["sn"]: {"sn": s["sn"], "name": s["name"], "subjects": {}, "overall_total": 0.0} for s in students}
    
    # Process each subject
    for sub_name in subjects:
        sheet_key = subj_sheet_map[sub_name]
        sub_grades = grades_store.get(sheet_key, {})
        
        # Collect overall totals for ranking in this subject
        subject_totals = []
        for s in students:
            sn_str = str(s["sn"])
            sg = sub_grades.get(sn_str, {"gw1": 0, "test": 0, "gw2": 0, "proj": 0, "exams": 0})
            
            sba_total = float(sg.get("gw1", 0) or 0) + float(sg.get("test", 0) or 0) + float(sg.get("gw2", 0) or 0) + float(sg.get("proj", 0) or 0)
            scaled_sba = (sba_total / 60.0) * 50.0
            scaled_exam = float(sg.get("exams", 0) or 0) * 0.5
            overall_total = scaled_sba + scaled_exam
            
            subject_totals.append((s["sn"], overall_total))
            
        # Rank students in this subject (descending)
        subject_totals.sort(key=lambda x: x[1], reverse=True)
        
        ranks = {}
        for rank_idx, (sn, total) in enumerate(subject_totals, 1):
            # Use 5 decimal precision check to resolve tiny float precision issues in ties
            tot_rounded = round(total, 5)
            prev_tot_rounded = round(subject_totals[rank_idx - 2][1], 5)
            if rank_idx > 1 and tot_rounded == prev_tot_rounded:
                ranks[sn] = ranks[subject_totals[rank_idx - 2][0]]
            else:
                ranks[sn] = rank_idx
                
        # Save details to student_scores
        for sn, total in subject_totals:
            grade_let, grade_rem = calculate_grade(total)
            student_scores[sn]["subjects"][sub_name] = {
                "total": total,
                "grade": grade_let,
                "remark": grade_rem,
                "rank": get_ordinal_suffix(ranks[sn])
            }
            student_scores[sn]["overall_total"] += total

    # Compute overall rankings
    student_list = list(student_scores.values())
    student_list.sort(key=lambda x: x["overall_total"], reverse=True)
    
    overall_ranks = {}
    for rank_idx, s in enumerate(student_list, 1):
        s_score = round(s["overall_total"], 5)
        prev_score = round(student_list[rank_idx - 2]["overall_total"], 5)
        if rank_idx > 1 and s_score == prev_score:
            overall_ranks[s["sn"]] = overall_ranks[student_list[rank_idx - 2]["sn"]]
        else:
            overall_ranks[s["sn"]] = rank_idx
            
    # Finalize student objects with overall rank and round for DB display
    for s in student_list:
        s["overall_total"] = round(s["overall_total"], 1)
        s["overall_rank"] = get_ordinal_suffix(overall_ranks[s["sn"]])
        for sub_name in s["subjects"]:
            s["subjects"][sub_name]["total"] = round(s["subjects"][sub_name]["total"], 1)
        
    return student_list
