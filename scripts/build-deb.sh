#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

if [ ! -d "$DIST_DIR/linux-unpacked" ]; then
    echo "❌ Error: $DIST_DIR/linux-unpacked not found. Run electron-builder first."
    exit 1
fi

VERSION=$(grep -m1 '"version"' "$ROOT_DIR/package.json" | cut -d '"' -f 4)
ARCH="amd64"
PKGNAME="pulsar-windows"

echo "📦 Packaging $PKGNAME v$VERSION for Debian / APT..."

STAGE_DIR=$(mktemp -d "/tmp/pulsar-windows-deb.XXXXXX")
trap 'rm -rf "$STAGE_DIR"' EXIT

PKG_DIR="$STAGE_DIR/pkg"
mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/opt/$PKGNAME"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/usr/share/applications"
mkdir -p "$PKG_DIR/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$PKG_DIR/usr/share/pixmaps"

# 1. Copy application files
cp -a "$DIST_DIR/linux-unpacked/." "$PKG_DIR/opt/$PKGNAME/"
chmod 755 "$PKG_DIR/opt/$PKGNAME/$PKGNAME"

# 2. Binary symlink
ln -sf "/opt/$PKGNAME/$PKGNAME" "$PKG_DIR/usr/bin/$PKGNAME"

# 3. Desktop entry
cat <<'EOF' > "$PKG_DIR/usr/share/applications/pulsar-windows.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Pulsar Windows
GenericName=Windows Compatibility Layer
Comment=Run Windows applications seamlessly on Pulsar OS
Comment[es]=Ejecuta aplicaciones de Windows en Pulsar OS de forma nativa
Exec=pulsar-windows %U
Icon=pulsar-windows
Terminal=false
Categories=Utility;Pulsar;System;
StartupWMClass=pulsar-windows
Keywords=windows;pulsar;vm;virtualization;rdp;freerdp;remoteapp;docker;kvm;apps;
MimeType=application/x-ms-dos-executable;application/x-msdownload;application/exe;application/x-exe;application/x-msi;application/vnd.microsoft.portable-executable;
EOF

# 4. Desktop entry for executing installer files directly
cat <<'EOF' > "$PKG_DIR/usr/share/applications/pulsar-windows-installer.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Pulsar Windows (Run in Windows)
Name[es]=Pulsar Windows (Ejecutar en Windows)
Comment=Run .exe and .msi files with Pulsar Windows
Comment[es]=Ejecutar archivos .exe y .msi con Pulsar Windows
Exec=pulsar-windows %f
Icon=pulsar-windows
Terminal=false
Categories=Utility;System;
MimeType=application/x-ms-dos-executable;application/x-msdownload;application/exe;application/x-exe;application/x-msi;application/vnd.microsoft.portable-executable;
NoDisplay=false
EOF

# 5. Icons
if [ -f "$ROOT_DIR/icons/winboat_logo.svg" ]; then
    cp "$ROOT_DIR/icons/winboat_logo.svg" "$PKG_DIR/usr/share/icons/hicolor/scalable/apps/pulsar-windows.svg"
fi
if [ -f "$ROOT_DIR/src/renderer/public/img/winboat_logo.png" ]; then
    cp "$ROOT_DIR/src/renderer/public/img/winboat_logo.png" "$PKG_DIR/usr/share/pixmaps/pulsar-windows.png"
fi

# 6. Calculate installed size (in KB)
INSTALLED_SIZE_KB=$(du -sk "$PKG_DIR" | awk '{print $1}')

# 7. Generate DEBIAN/control
cat <<EOF > "$PKG_DIR/DEBIAN/control"
Package: $PKGNAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Maintainer: Jaime <info@inled.es>
Installed-Size: $INSTALLED_SIZE_KB
Depends: freerdp3-x11 | freerdp2-x11, libgtk-3-0t64 | libgtk-3-0, libasound2t64 | libasound2, libnss3
Recommends: docker.io | podman
Provides: winboat
Conflicts: winboat
Replaces: winboat
Description: Windows Subsystem & Native App Integration for Pulsar OS
 Seamlessly run Windows applications, .exe installers, and virtualized Windows workflows directly on Pulsar OS.
EOF

# 8. Generate DEBIAN/postinst
cat <<'EOF' > "$PKG_DIR/DEBIAN/postinst"
#!/bin/sh
set -e
update-desktop-database -q /usr/share/applications 2>/dev/null || true
if command -v xdg-mime >/dev/null 2>&1; then
    xdg-mime default pulsar-windows.desktop application/x-ms-dos-executable 2>/dev/null || true
    xdg-mime default pulsar-windows.desktop application/x-msdownload 2>/dev/null || true
    xdg-mime default pulsar-windows.desktop application/exe 2>/dev/null || true
    xdg-mime default pulsar-windows.desktop application/x-exe 2>/dev/null || true
    xdg-mime default pulsar-windows.desktop application/x-msi 2>/dev/null || true
    xdg-mime default pulsar-windows.desktop application/vnd.microsoft.portable-executable 2>/dev/null || true
fi
exit 0
EOF
chmod 755 "$PKG_DIR/DEBIAN/postinst"

OUT_DEB="$DIST_DIR/${PKGNAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$PKG_DIR" "$OUT_DEB"

echo "✅ Debian package created:"
echo "   $OUT_DEB"
