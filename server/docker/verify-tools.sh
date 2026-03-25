#!/bin/bash
# Hex AI - Tool Installation Verification Script
# Checks that all 42 tools are properly installed

echo "🔍 Verifying Hex AI Tool Arsenal Installation..."
echo "=================================================="

MISSING=0
INSTALLED=0

check_tool() {
    if command -v "$1" &> /dev/null; then
        echo "✅ $1"
        ((INSTALLED++))
    else
        echo "❌ $1 - NOT FOUND"
        ((MISSING++))
    fi
}

echo ""
echo "🌐 Network Scanning & Reconnaissance:"
check_tool nmap
check_tool masscan
check_tool zmap
check_tool rustscan
check_tool subfinder
check_tool amass
check_tool httpx

echo ""
echo "🕸️ Web Application Testing:"
check_tool sqlmap
check_tool nuclei
check_tool ffuf
check_tool feroxbuster
check_tool gobuster
check_tool nikto
check_tool wpscan
check_tool whatweb
check_tool curl
check_tool sslscan

echo ""
echo "💀 Active Directory & Windows:"
check_tool crackmapexec
check_tool kerbrute
check_tool responder
check_tool enum4linux
check_tool enum4linux-ng
check_tool ldapsearch
check_tool rpcclient
check_tool smbclient

echo ""
echo "🔐 Password Cracking:"
check_tool hydra
check_tool hashcat
check_tool john

echo ""
echo "💣 Exploitation:"
check_tool msfconsole

echo ""
echo "📡 WiFi / Wireless:"
check_tool aircrack-ng
check_tool wifite
check_tool bettercap
check_tool reaver
check_tool wash
check_tool mdk4
check_tool kismet

echo ""
echo "🌉 Pivoting & Tunneling:"
check_tool chisel
check_tool socat
check_tool nc
check_tool proxychains4

echo ""
echo "📝 Utilities:"
check_tool whois
check_tool dig

echo ""
echo "🐍 Python Tools:"
if python3 -c "import impacket" 2>/dev/null; then
    echo "✅ impacket"
    ((INSTALLED++))
else
    echo "❌ impacket - NOT FOUND"
    ((MISSING++))
fi

echo ""
echo "=================================================="
echo "📊 SUMMARY:"
echo "   ✅ Installed: $INSTALLED"
echo "   ❌ Missing:   $MISSING"
echo "=================================================="

if [ $MISSING -eq 0 ]; then
    echo "🎉 ALL TOOLS INSTALLED SUCCESSFULLY!"
    exit 0
else
    echo "⚠️  Some tools are missing. Check installation."
    exit 1
fi
















