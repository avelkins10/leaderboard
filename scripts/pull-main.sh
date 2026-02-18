#!/bin/bash
cd /vercel/share/v0-project
git fetch origin main
git merge origin/main --no-edit
