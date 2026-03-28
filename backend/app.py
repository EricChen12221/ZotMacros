from datetime import date, datetime

from cachetools import TTLCache, cached
from flask import Flask, request, jsonify
from flask_cors import CORS
from anteater_api import get_restaurants, get_restaurant_today, get_dishes_batch
from models import Dish, parse_dish
from recommend import recommend
 
app = Flask(__name__)
CORS(app)

RESTAURANT_IDS = ["anteatery", "brandywine"]
RESTAURANT_LABELS = {"anteatery": "Anteatery", "brandywine": "Brandywine"}

#Goals
CALORIE_GOAL = 0
PROTEIN_GOAL = 0

LOGGED_FOODS = []  # In-memory log of added dishes (for demo purposes)
TOTAL_CALORIES = 0
TOTAL_PROTEIN = 0
ALL_DISHES = {}  # Cache of all dishes for recommendation (in a real app, you'd want a smarter cache or DB)

restaurant_cache = TTLCache(maxsize=50, ttl=300)  # 5 minutes
restaurant_today_cache = TTLCache(maxsize=200, ttl=300)

@app.route("/")
def home():
    return "Server is running"

@app.route("/calculate", methods=["POST"])
def calculate():
    
    # POST logic
    data = request.json
    grades = data.get("grades", [])
    if not grades:
        return jsonify({"error": "No grades provided"}), 400
    average = sum(grades) / len(grades)
    if average >= 90: letter = "A"
    elif average >= 80: letter = "B"
    elif average >= 70: letter = "C"
    elif average >= 60: letter = "D"
    else: letter = "F"
    return jsonify({"average": round(average, 2), "letter": letter})

@app.route("/log_food", methods=["POST"])
def log_food():
    data = request.json
    dish = data.get("dish")
    if not dish:
        return None, 400
    LOGGED_FOODS.append(dish)
    # Update total calories and protein
    global TOTAL_CALORIES, TOTAL_PROTEIN
    TOTAL_CALORIES += dish.get("calories", 0)
    TOTAL_PROTEIN += dish.get("protein", 0)

    return jsonify({"message": f"Logged dish {dish.get('name', 'Unknown')}", "logged_foods": LOGGED_FOODS})

@app.route("/remove_food", methods=["POST"])
def remove_food():
    data = request.json
    dish = data.get("dish")
    if not dish:
        return jsonify({"error": "No dish provided"}), 400

    global TOTAL_CALORIES, TOTAL_PROTEIN

    if dish in LOGGED_FOODS:
        LOGGED_FOODS.remove(dish)
        TOTAL_CALORIES -= dish.get("calories", 0)
        TOTAL_PROTEIN -= dish.get("protein", 0)
        return jsonify({"message": f"Removed {dish.get('name', 'Unknown')}", "logged_foods": LOGGED_FOODS})
    else:
        return jsonify({"error": "Dish not found in logged foods"}), 404
 
@app.route("/recommended", methods=["GET"])
def get_recommended_dishes():
    return jsonify(recommend(
        dishes=list(ALL_DISHES.values()),
        cal_left=max(0, CALORIE_GOAL - TOTAL_CALORIES),
        protein_left=max(0, PROTEIN_GOAL - TOTAL_PROTEIN),
    ))

@app.route("/goals", methods=["GET"])
def get_goals():
    return jsonify({
        "logged_foods": LOGGED_FOODS,
        "calorie_goal": CALORIE_GOAL,
        "protein_goal": PROTEIN_GOAL,
        "calories_consumed": TOTAL_CALORIES,
        "protein_consumed": TOTAL_PROTEIN,
    })

@app.route("/set_goals", methods=["POST"])
def set_goals():
    global CALORIE_GOAL, PROTEIN_GOAL
    data = request.json
    CALORIE_GOAL = data.get("calorie_goal", 0)
    PROTEIN_GOAL = data.get("protein_goal", 0)
    return jsonify({"message": "Goals set successfully"})

@app.route("/stations", methods=["POST"])
def stations():
    data = request.json or {}

    # Ensure lowercase restaurant_id to match Anteater API requirements
    restaurant_id = (data.get("tab") or "anteatery").lower()
    day_iso = date.today().isoformat()
    day_iso = "2026-03-22"

    # Fetch today's data safely
    try:
        today_data = cached_restaurant_today(restaurant_id, day_iso)
    except Exception as e:
        return jsonify({"error": f"API call failed: {e}"}), 500

    periods = today_data.get("periods") or {}
    if not periods:
        return jsonify({"error": "No periods available"}), 404

    # Get current period based on time of day
    period_key = get_current_period(periods)
    if not period_key:
        return jsonify({"error": "No matching period for current time"}), 404
    period_obj = periods.get(period_key, {})
    station_to_dishes = period_obj.get("stationToDishes") or {}
    # Map station IDs → display names
    station_name_map = _station_name_map(restaurant_id)
    # Build response with full dish info
    result = []
    for station_id, dish_ids in station_to_dishes.items():
        dish_ids = [str(x) for x in dish_ids]  # ensure strings

        raw_dishes = get_dishes_batch(dish_ids)

        dishes = []
        for d in raw_dishes:
            parsed = parse_dish(d)
            dish = {
                "id": parsed.id,
                "name": parsed.name,
                "calories": parsed.calories,
                "protein": parsed.protein_g,
                "image": parsed.image_url,
            }
            dishes.append(dish)
            ALL_DISHES[dish["id"]] = dish  # Cache for recommendation
        

        result.append({
            "station_id": station_id,
            "station_name": station_name_map.get(station_id, station_id),
            "dishes": dishes
        })

    return jsonify({
        "restaurant": restaurant_id,
        "date": datetime.fromisoformat(day_iso),
        "period": period_obj.get("name"),
        "stations": result
    })


def get_current_period(periods: dict) -> str | None:
    """Return current meal period key based on time of day"""
    hour = datetime.now().hour

    # Simple heuristic (you can tweak)
    if hour < 11:
        target = "breakfast"
    elif hour < 16:
        target = ["brunch", "lunch"]
    else:
        target = "dinner"
    # Match against API keys
    for key, value in periods.items():
        name = (value.get("name") or "").lower()
        if name in target:
            return key

    return None


def cached_restaurants(restaurant_id: str | None) -> list[dict]:
    if restaurant_id in restaurant_cache:
        return restaurant_cache[restaurant_id]
    data = get_restaurants(restaurant_id)
    restaurant_cache[restaurant_id] = data
    return data


def cached_restaurant_today(restaurant_id: str, day_iso: str) -> dict:
    if (restaurant_id, day_iso) in restaurant_today_cache:
        return restaurant_today_cache[(restaurant_id, day_iso)]
    data = get_restaurant_today(restaurant_id, day_iso)
    restaurant_today_cache[(restaurant_id, day_iso)] = data
    return data


def _station_name_map(restaurant_id: str) -> dict[str, str]:
    """Map station id -> display name from /restaurants."""
    raw = cached_restaurants(restaurant_id)
    name_map = {}
    items = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) else [])
    for r in items:
        if not isinstance(r, dict):
            continue
        for s in r.get("stations") or []:
            if not isinstance(s, dict):
                continue
            sid = s.get("id") or s.get("stationId")
            if sid:
                name_map[str(sid)] = s.get("name") or s.get("stationName") or str(sid)
    return name_map

if __name__ == "__main__":
    app.run(debug=True)