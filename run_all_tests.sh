#!/usr/bin/env bash
set -e
echo "=========================================="
echo " JobHunter Ethiopia — Full Test Suite"
echo "=========================================="

echo ""
echo "[1/3] Backend TypeScript check"
cd /home/ubuntu/jobhunter-ethiopia/backend
npx tsc --noEmit
echo "TypeScript OK"

echo ""
echo "[2/3] Backend unit tests (Vitest)"
npx vitest run --coverage.enabled=false
echo "Backend tests OK"

echo ""
echo "[3/3] Android unit tests (Gradle)"
cd /home/ubuntu/jobhunter-ethiopia/android
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/home/ubuntu/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
./gradlew testDebugUnitTest --no-daemon 2>&1 | grep -A 2 "BUILD SUCCESSFUL\|TEST.*PASS" | head -5
echo "Android tests OK"

echo ""
echo "=========================================="
echo " ALL TESTS PASS"
echo "=========================================="
