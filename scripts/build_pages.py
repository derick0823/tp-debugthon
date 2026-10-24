#!/usr/bin/env python3
import os
import shutil

def build():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    site_dir = os.path.join(root, "_site")
    mvp_dir = os.path.join(root, "2026-10-23-mvp", "research", "issue-06", "mvp-variants")
    solutions_dir = os.path.join(root, "2026-10-23-mvp", "research", "issue-06", "solutions")

    if os.path.exists(site_dir):
        shutil.rmtree(site_dir)
    os.makedirs(site_dir, exist_ok=True)

    # 1. Copy mvp-variants directly into _site root
    shutil.copytree(mvp_dir, site_dir, dirs_exist_ok=True)

    # 2. Copy solutions into _site/solutions
    dest_solutions = os.path.join(site_dir, "solutions")
    shutil.copytree(solutions_dir, dest_solutions, dirs_exist_ok=True)

    # 3. Adjust relative paths in html, js, and css files
    for dirpath, _, filenames in os.walk(site_dir):
        for fname in filenames:
            if fname.endswith((".html", ".js", ".css")):
                fpath = os.path.join(dirpath, fname)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                
                new_content = content.replace("../../solutions/", "../solutions/")
                new_content = new_content.replace("../solutions/prototype/data/buildings/", "solutions/prototype/data/buildings/")
                
                if new_content != content:
                    with open(fpath, "w", encoding="utf-8") as fp:
                        fp.write(new_content)

    # 4. Create .nojekyll to disable Jekyll processing
    with open(os.path.join(site_dir, ".nojekyll"), "w", encoding="utf-8") as fp:
        fp.write("# disable jekyll\n")

    print(f"Site built successfully at {site_dir}")

if __name__ == "__main__":
    build()
