# Icon Resize Script for Traffic Cop Extension
# Converts 1024x1024 source image to multiple sizes

Add-Type -AssemblyName System.Drawing

# Source file from media folder
$sourceFile = ".\media\cop-1024x1024.png"

# Check if source exists
if (-not (Test-Path $sourceFile)) {
    Write-Host "Error: Source file '$sourceFile' not found!" -ForegroundColor Red
    Write-Host "Please place the 1024x1024 PNG in the media folder first." -ForegroundColor Yellow
    exit 1
}

Write-Host "Converting icon from 1024x1024 to multiple sizes..." -ForegroundColor Cyan

$sizes = @(512, 256, 128)

foreach ($size in $sizes) {
    try {
        # Load source image
        $img = [System.Drawing.Image]::FromFile((Resolve-Path $sourceFile))
        
        # Create new bitmap with target size
        $resized = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        
        # High quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        
        # Draw resized image
        $graphics.DrawImage($img, 0, 0, $size, $size)
        
        # Save with appropriate name
        if ($size -eq 256) {
            $outputFile = "icon.png"
        } else {
            $outputFile = "icon-$size.png"
        }
        
        $resized.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "✓ Created $outputFile ($size x $size)" -ForegroundColor Green
        
        # Cleanup
        $graphics.Dispose()
        $resized.Dispose()
        $img.Dispose()
    }
    catch {
        Write-Host "Error creating ${size}x${size} icon: $_" -ForegroundColor Red
    }
}

Write-Host "`nIcon conversion complete!" -ForegroundColor Green
Write-Host "Primary icon: icon.png (256x256)" -ForegroundColor Cyan
