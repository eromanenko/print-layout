# Build script for Print Layout Generator CLI
Write-Host "Installing dependencies..."
pip install reportlab pillow pyinstaller

Write-Host "Building executable..."
pyinstaller --onefile --console --name print_layout_cli generate_pdf.py

Write-Host "Cleaning up temporary build files..."
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "print_layout_cli.spec") { Remove-Item -Force "print_layout_cli.spec" }

Write-Host "Build complete! You can find the executable in the 'dist' folder."
