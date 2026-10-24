#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

if [ ! -d "$DIST_DIR/linux-unpacked" ]; then
    echo "❌ Error: $DIST_DIR/linux-unpacked not found. Run electron-builder first."
    exit 1
fi

VERSION=$(bun -e "console.log(require('./package.json').version)" 2>/dev/null || grep -m1 '"version"' "$ROOT_DIR/package.json" | cut -d '"' -f 4)
PKGREL="1"
ARCH="x86_64"
PKGNAME="pulsar-windows"

echo "📦 Packaging $PKGNAME v$VERSION-$PKGREL for Arch Linux / Pacman..."

STAGE_DIR=$(mktemp -d "/tmp/pulsar-windows-arch.XXXXXX")
trap 'rm -rf "$STAGE_DIR"' EXIT

PKG_DIR="$STAGE_DIR/pkg"
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

# 6. Calculate total installed size in bytes
INSTALLED_SIZE=$(du -sb "$PKG_DIR" | awk '{print $1}')
BUILD_DATE=$(date +%s)

# 7. Generate .PKGINFO
cat <<EOF > "$PKG_DIR/.PKGINFO"
pkgname = $PKGNAME
pkgbase = $PKGNAME
pkgver = $VERSION-$PKGREL
pkgdesc = Windows Subsystem & Native App Integration for Pulsar OS
url = https://github.com/Inled-Pulsar-OS/pulsar-windows
builddate = $BUILD_DATE
packager = Inled <info@inled.es>
size = $INSTALLED_SIZE
arch = $ARCH
license = MIT
depend = freerdp
depend = gtk3
depend = alsa-lib
depend = nss
depend = docker
optdepend = podman-compose: To use podman as a container runtime
provides = winboat
conflict = winboat
EOF

# 8. Generate .INSTALL hook
cat <<'EOF' > "$PKG_DIR/.INSTALL"
post_install() {
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
    if command -v xdg-mime >/dev/null 2>&1; then
        xdg-mime default pulsar-windows.desktop application/x-ms-dos-executable || true
        xdg-mime default pulsar-windows.desktop application/x-msdownload || true
        xdg-mime default pulsar-windows.desktop application/exe || true
        xdg-mime default pulsar-windows.desktop application/x-exe || true
        xdg-mime default pulsar-windows.desktop application/x-msi || true
        xdg-mime default pulsar-windows.desktop application/vnd.microsoft.portable-executable || true
    fi
}

post_upgrade() {
    post_install
}
EOF

# 9. Create Arch package archive (.pkg.tar.zst) and .pacman copy
OUT_PKG="$DIST_DIR/${PKGNAME}-${VERSION}-${PKGREL}-${ARCH}.pkg.tar.zst"
OUT_PACMAN="$DIST_DIR/${PKGNAME}-${VERSION}-${ARCH}.pacman"

echo "🗜️ Compressing pacman package archive..."
(
    cd "$PKG_DIR"
    bsdtar --uid 0 --gid 0 -cf - .PKGINFO .INSTALL opt usr | zstd -c -T0 -14 > "$OUT_PKG"
)

cp "$OUT_PKG" "$OUT_PACMAN"

echo "✅ Pacman package created:"
echo "   $OUT_PKG"
echo "   $OUT_PACMAN"
