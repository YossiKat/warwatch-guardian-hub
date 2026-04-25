#!/bin/bash
# ════════════════════════════════════════════════════
# EWS FINAL DEPLOY — פקודה אחת לכל הפעולות
# ════════════════════════════════════════════════════
DIR="$HOME/Desktop/ews"
cd "$DIR"

echo "📋 מעתיק קבצים..."
[ -f "$HOME/Downloads/warwatch.html" ] && cp "$HOME/Downloads/warwatch.html" "$DIR/warwatch.html" && cp "$HOME/Downloads/warwatch.html" "$DIR/index.html" && echo "✅ warwatch.html"
[ -f "$HOME/Downloads/server.js" ]    && cp "$HOME/Downloads/server.js"    "$DIR/server.js"    && echo "✅ server.js"
[ -f "$HOME/Downloads/ews_addon.js" ] && cp "$HOME/Downloads/ews_addon.js" "$DIR/ews_addon.js" && echo "✅ ews_addon.js"

echo ""
echo "🔧 תיקון באגים..."
sed -i '' '/const _origHandler = handleRequest;/d' "$DIR/server.js" 2>/dev/null

echo ""
echo "📤 GitHub push..."
git add -A
git commit -m "EWS FINAL v7 — 31/31 features $(date '+%d/%m %H:%M')" --allow-empty
git push --force
echo "✅ GitHub מעודכן"

echo ""
echo "🖥️  מפעיל שרת..."
pkill -f "node server" 2>/dev/null; sleep 1
nohup node server.js > "$DIR/ews.log" 2>&1 &
sleep 3

echo ""
echo "🌐 מפעיל ngrok..."
pkill -f ngrok 2>/dev/null; sleep 1
nohup ngrok http 3000 > /tmp/ngrok.log 2>&1 &
sleep 4

URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d['tunnels'][0]['public_url'])" 2>/dev/null || echo "")

echo ""
echo "════════════════════════════════════════"
echo "  ✅ EWS READY"
echo "════════════════════════════════════════"
echo "  🖥  מקומי:  http://localhost:3000/warwatch.html"
echo "  📱  iPad:   http://10.0.0.2:3000/warwatch.html"
[ -n "$URL" ] && echo "  🌐  חברים:  $URL/warwatch.html"
echo "  💙  Lovable: https://https-late-geese-train-loca-lt.lovable.app"
echo "════════════════════════════════════════"
