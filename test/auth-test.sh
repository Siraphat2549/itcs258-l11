#!/usr/bin/env bash
# Manual test script for the Auth + protected Rooms endpoints.
# Task 6 (previous lab): JWT auth guards a protected route.
# Task 4 (this lab): Role-Based Access Control on room create/update/delete.
# Usage: start the app (npm run start:dev) in one terminal, then run this script.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
STAMP=$(date +%s)
ADMIN_USERNAME="rbac_admin_$STAMP"
USER_USERNAME="rbac_user_$STAMP"
PASSWORD="Password123!"
PASS=0
FAIL=0

json_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(o['$1']??'')}catch(e){console.log('')}})"
}

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $desc (status $actual)"
    PASS=$((PASS+1))
  else
    echo "FAIL: $desc (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo "== 1. Register an ADMIN user =="
ADMIN_REGISTER_STATUS=$(curl -s -o /tmp/admin_register.json -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$PASSWORD\",\"role\":\"ADMIN\"}")
cat /tmp/admin_register.json
echo
check "Register ADMIN user" "201" "$ADMIN_REGISTER_STATUS"

echo
echo "== 2. Register a plain USER =="
USER_REGISTER_STATUS=$(curl -s -o /tmp/user_register.json -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_USERNAME\",\"password\":\"$PASSWORD\"}")
cat /tmp/user_register.json
echo
check "Register USER (defaults to role USER)" "201" "$USER_REGISTER_STATUS"

echo
echo "== 3. Login as ADMIN and capture JWT =="
ADMIN_LOGIN_STATUS=$(curl -s -o /tmp/admin_login.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$PASSWORD\"}")
cat /tmp/admin_login.json
echo
check "Login as ADMIN" "200" "$ADMIN_LOGIN_STATUS"
ADMIN_TOKEN=$(cat /tmp/admin_login.json | json_field access_token)

echo
echo "== 4. Login as USER and capture JWT =="
USER_LOGIN_STATUS=$(curl -s -o /tmp/user_login.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_USERNAME\",\"password\":\"$PASSWORD\"}")
cat /tmp/user_login.json
echo
check "Login as USER" "200" "$USER_LOGIN_STATUS"
USER_TOKEN=$(cat /tmp/user_login.json | json_field access_token)

echo
echo "== 5. Create room WITHOUT token (should fail with 401) =="
NO_TOKEN_STATUS=$(curl -s -o /tmp/no_token.json -w "%{http_code}" -X POST "$BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{"name":"Deluxe Room","capacity":2,"price_per_night":1500}')
cat /tmp/no_token.json
echo
check "Create room without token is rejected" "401" "$NO_TOKEN_STATUS"

echo
echo "== 6. Create room as USER (should fail with 403 - RBAC) =="
USER_CREATE_STATUS=$(curl -s -o /tmp/user_create.json -w "%{http_code}" -X POST "$BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"name":"Deluxe Room","capacity":2,"price_per_night":1500}')
cat /tmp/user_create.json
echo
check "Create room as USER is forbidden" "403" "$USER_CREATE_STATUS"

echo
echo "== 7. Create room as ADMIN (should succeed with 201 - RBAC) =="
ADMIN_CREATE_STATUS=$(curl -s -o /tmp/create.json -w "%{http_code}" -X POST "$BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Deluxe Room","capacity":2,"price_per_night":1500}')
cat /tmp/create.json
echo
check "Create room as ADMIN succeeds" "201" "$ADMIN_CREATE_STATUS"
ROOM_ID=$(cat /tmp/create.json | json_field id)

echo
echo "== 8. Get room info WITHOUT token (should fail with 401) =="
GET_NO_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/rooms/$ROOM_ID")
check "Get room without token is rejected" "401" "$GET_NO_TOKEN_STATUS"

echo
echo "== 9. Get room info as USER (should succeed with 200 - reads are not admin-only) =="
GET_STATUS=$(curl -s -o /tmp/get.json -w "%{http_code}" "$BASE_URL/rooms/$ROOM_ID" \
  -H "Authorization: Bearer $USER_TOKEN")
cat /tmp/get.json
echo
check "Get room as USER succeeds" "200" "$GET_STATUS"

echo
echo "== 10. Update room as USER (should fail with 403 - RBAC) =="
USER_UPDATE_STATUS=$(curl -s -o /tmp/user_update.json -w "%{http_code}" -X PUT "$BASE_URL/rooms/$ROOM_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"price_per_night":1800}')
cat /tmp/user_update.json
echo
check "Update room as USER is forbidden" "403" "$USER_UPDATE_STATUS"

echo
echo "== 11. Update room as ADMIN (should succeed with 200 - RBAC) =="
ADMIN_UPDATE_STATUS=$(curl -s -o /tmp/update.json -w "%{http_code}" -X PUT "$BASE_URL/rooms/$ROOM_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"price_per_night":1800}')
cat /tmp/update.json
echo
check "Update room as ADMIN succeeds" "200" "$ADMIN_UPDATE_STATUS"

echo
echo "== 12. Delete room WITHOUT token (should fail with 401) =="
DELETE_NO_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/rooms/$ROOM_ID")
check "Delete room without token is rejected" "401" "$DELETE_NO_TOKEN_STATUS"

echo
echo "== 13. Delete room as USER (should fail with 403 - RBAC) =="
USER_DELETE_STATUS=$(curl -s -o /tmp/user_delete.json -w "%{http_code}" -X DELETE "$BASE_URL/rooms/$ROOM_ID" \
  -H "Authorization: Bearer $USER_TOKEN")
cat /tmp/user_delete.json
echo
check "Delete room as USER is forbidden" "403" "$USER_DELETE_STATUS"

echo
echo "== 14. Delete room as ADMIN (should succeed with 200 - RBAC) =="
ADMIN_DELETE_STATUS=$(curl -s -o /tmp/delete.json -w "%{http_code}" -X DELETE "$BASE_URL/rooms/$ROOM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
cat /tmp/delete.json
echo
check "Delete room as ADMIN succeeds" "200" "$ADMIN_DELETE_STATUS"

echo
echo "== 15. Access with an invalid/garbage token (should fail with 401) =="
BAD_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/rooms/1" \
  -H "Authorization: Bearer not.a.real.token")
check "Access with invalid token is rejected" "401" "$BAD_TOKEN_STATUS"

echo
echo "========================================"
echo "Results: $PASS passed, $FAIL failed"
echo "========================================"

rm -f /tmp/admin_register.json /tmp/user_register.json /tmp/admin_login.json /tmp/user_login.json \
  /tmp/no_token.json /tmp/user_create.json /tmp/create.json /tmp/get.json /tmp/user_update.json \
  /tmp/update.json /tmp/user_delete.json /tmp/delete.json

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
