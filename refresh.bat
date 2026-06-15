@echo off
chcp 65001 >nul
title Desert Peax - רענון קטלוג
echo ============================================
echo   מרענן את הקטלוג מהאתר desertpeax.co.il
echo ============================================
echo.
node build.js
if %errorlevel% neq 0 (
  echo.
  echo  אירעה שגיאה. ודא שיש חיבור לאינטרנט וש-Node.js מותקן.
  pause
  exit /b 1
)
echo.
echo  מעלה לאוויר...
git add catalog-b2c.html catalog-b2b.html catalog-b2c.pdf catalog-b2b.pdf email-b2c.html email-b2b.html catalog-data.json
git commit -m "Refresh catalog from store" >nul 2>&1
git push
echo.
echo  ✓ בוצע! הקטלוג המעודכן עלה לאוויר.
echo  קישורים:
echo    B2C: https://shlavbitan14-wq.github.io/DeasertPeax-Catalog/catalog-b2c.html
echo    B2B: https://shlavbitan14-wq.github.io/DeasertPeax-Catalog/catalog-b2b.html
echo  קבצי PDF לשליחה במייל: catalog-b2c.pdf / catalog-b2b.pdf
echo.
pause
