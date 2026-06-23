"""Get full details for the best casualty datasets found in search."""
import requests

API_KEY = "sqMoyqUg361LgOyGP0wn"

# Best candidates from search results — get their project details
targets = [
    ("fallen-people-data-set",   "fallen person"),       # 2876 images
    ("fallen-person-64goj",      "fallen person"),       # 487 images
    ("aerial-person-detection",  "aerial person"),       # 7015 images
    ("lying-glihm",              "person lying"),        # 1659 images
    ("project-avtuf",            "fallen person"),       # 3306 images
]

for ws_slug, term in targets:
    print(f"\n--- workspace: {ws_slug} ---")
    try:
        r = requests.get(
            f"https://api.roboflow.com/{ws_slug}",
            params={"api_key": API_KEY},
            timeout=15
        )
        data = r.json()
        if "workspace" in data:
            ws = data["workspace"]
            print(f"  Workspace: {ws.get('name')} ({ws.get('slug')})")
            for proj in ws.get("projects", [])[:10]:
                print(f"    Project: {proj.get('name')} | slug: {proj.get('id')} | images: {proj.get('imageCount')} | versions: {proj.get('versions')}")
        else:
            print(f"  Response keys: {list(data.keys())}")
            if "project" in data:
                p = data["project"]
                print(f"  Project: {p.get('name')} | images: {p.get('imageCount')}")
                for v in p.get("versions", []):
                    print(f"    v{v.get('id')}: {v.get('images')} images | type: {v.get('type')}")
    except Exception as e:
        print(f"  error: {e}")
