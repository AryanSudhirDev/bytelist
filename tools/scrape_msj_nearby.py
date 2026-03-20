#!/usr/bin/env python3
import json
import math
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone

CENTER_LAT = 37.5232
CENTER_LON = -121.9241
RADIUS_METERS = 24140  # 15 miles
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_PATH = "data/msj_nearby_places.json"


def haversine_miles(lat1, lon1, lat2, lon2):
    r = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def infer_menu_options(cuisine_text):
    cuisine = (cuisine_text or "").lower()
    options = set()
    mapping = {
        "burger": ["Cheeseburger", "Fries", "Chicken Sandwich", "Milkshake"],
        "pizza": ["Margherita Pizza", "Pepperoni Pizza", "Garlic Bread", "Pasta"],
        "ramen": ["Tonkotsu Ramen", "Miso Ramen", "Shoyu Ramen", "Gyoza"],
        "japanese": ["Sushi Roll", "Ramen", "Donburi", "Tempura"],
        "chinese": ["Fried Rice", "Chow Mein", "Orange Chicken", "Dumplings"],
        "indian": ["Butter Chicken", "Paneer Tikka", "Naan", "Biryani"],
        "mexican": ["Burrito", "Tacos", "Quesadilla", "Nachos"],
        "thai": ["Pad Thai", "Green Curry", "Thai Iced Tea", "Tom Yum"],
        "vietnamese": ["Pho", "Banh Mi", "Spring Rolls", "Vermicelli Bowl"],
        "korean": ["Bibimbap", "Korean Fried Chicken", "Kimchi Fried Rice", "Tteokbokki"],
        "bubble_tea": ["Classic Milk Tea", "Taro Milk Tea", "Thai Tea", "Fruit Tea"],
        "tea": ["Milk Tea", "Fruit Tea", "Jasmine Tea", "Thai Tea"],
        "coffee_shop": ["Latte", "Cappuccino", "Cold Brew", "Mocha"],
        "coffee": ["Latte", "Cappuccino", "Cold Brew", "Mocha"],
        "dessert": ["Ice Cream", "Cheesecake", "Cookie", "Brownie"],
        "ice_cream": ["Vanilla Scoop", "Chocolate Scoop", "Sundae", "Milkshake"],
        "sandwich": ["Turkey Sandwich", "Veggie Sandwich", "BLT", "Soup Combo"],
        "chicken": ["Chicken Tenders", "Chicken Sandwich", "Wings", "Fries"],
        "fast_food": ["Combo Meal", "Burger", "Fries", "Soda"]
    }
    for key, values in mapping.items():
        if key in cuisine:
            options.update(values)
    if not options:
        options.update(["House Special", "Popular Combo", "Chef Recommendation"])
    return sorted(options)


def overpass_query():
    # amenity-based food businesses within 15 miles of MSJHS
    return f"""
[out:json][timeout:60];
(
  node["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"](around:{RADIUS_METERS},{CENTER_LAT},{CENTER_LON});
  way["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"](around:{RADIUS_METERS},{CENTER_LAT},{CENTER_LON});
  relation["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"](around:{RADIUS_METERS},{CENTER_LAT},{CENTER_LON});
);
out center tags;
"""


def main():
    data = urllib.parse.urlencode({"data": overpass_query()}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=data, method="POST")
    ssl_ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=90, context=ssl_ctx) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    seen = set()
    places = []
    for el in payload.get("elements", []):
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        lat = el.get("lat")
        lon = el.get("lon")
        center = el.get("center", {})
        if lat is None:
            lat = center.get("lat")
        if lon is None:
            lon = center.get("lon")
        if lat is None or lon is None:
            continue

        key = f"{name.lower()}::{round(lat,5)}::{round(lon,5)}"
        if key in seen:
            continue
        seen.add(key)

        miles = haversine_miles(CENTER_LAT, CENTER_LON, lat, lon)
        cuisine = tags.get("cuisine", tags.get("amenity", "food"))
        menu_options = infer_menu_options(cuisine)
        place = {
            "id": f"osm_{el.get('type','x')}_{el.get('id')}",
            "name": name,
            "category": tags.get("amenity", "food"),
            "cuisine": cuisine,
            "location": ", ".join(
                part
                for part in [
                    tags.get("addr:housenumber"),
                    tags.get("addr:street"),
                    tags.get("addr:city")
                ]
                if part
            )
            or "Near Mission San Jose",
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "distanceMiles": round(miles, 2),
            "radiusBucket": 2 if miles <= 2 else 5 if miles <= 5 else 10 if miles <= 10 else 15,
            "website": tags.get("website", ""),
            "menuUrl": tags.get("menu", ""),
            "menuOptions": menu_options,
            "menuSource": "OpenStreetMap cuisine tags (inferred item list)"
        }
        places.append(place)

    places.sort(key=lambda x: (x["distanceMiles"], x["name"].lower()))
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "center": {
                    "name": "Mission San Jose High School",
                    "lat": CENTER_LAT,
                    "lon": CENTER_LON
                },
                "maxRadiusMiles": 15,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "totalPlaces": len(places),
                "places": places
            },
            f,
            indent=2
        )
    print(f"Wrote {len(places)} places to {OUT_PATH}")


if __name__ == "__main__":
    main()
