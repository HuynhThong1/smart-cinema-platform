"""Configure service access and admin-only cinema scope in the local development realm."""
import json
import os
import urllib.parse
import urllib.request

base = 'http://localhost:8081'
realm = 'smart-cinema'
password = os.environ.get('KEYCLOAK_ADMIN_PASSWORD', 'local-development-only')
secret = os.environ.get('KEYCLOAK_SERVICE_SECRET', 'local-service-secret-change-before-deployment')
data = urllib.parse.urlencode({'client_id': 'admin-cli', 'username': 'local-admin', 'password': password, 'grant_type': 'password'}).encode()
with urllib.request.urlopen(base + '/realms/master/protocol/openid-connect/token', data=data, timeout=20) as response:
    token = json.load(response)['access_token']

def request(method, path, body=None):
    req = urllib.request.Request(base + '/admin/realms/' + realm + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        raw = response.read()
        return json.loads(raw) if raw else None

client_id = 'smart-cinema-service'
clients = request('GET', '/clients?clientId=' + client_id)
if not clients:
    request('POST', '/clients', {'clientId': client_id, 'enabled': True, 'publicClient': False, 'secret': secret, 'serviceAccountsEnabled': True, 'standardFlowEnabled': False, 'directAccessGrantsEnabled': False})
    clients = request('GET', '/clients?clientId=' + client_id)
service = request('GET', '/clients/' + clients[0]['id'] + '/service-account-user')
management = request('GET', '/clients?clientId=realm-management')[0]
roles = [request('GET', '/clients/' + management['id'] + '/roles/' + name) for name in ['view-users', 'query-users', 'manage-users', 'view-realm']]
request('POST', '/users/' + service['id'] + '/role-mappings/clients/' + management['id'], roles)
profile = request('GET', '/users/profile')
profile['attributes'] = [attribute for attribute in profile['attributes'] if attribute.get('name') != 'cinema_id']
profile['attributes'].append({'name': 'cinema_id', 'displayName': 'Cinema scope', 'permissions': {'view': ['admin'], 'edit': ['admin']}, 'multivalued': False})
request('PUT', '/users/profile', profile)
print('Local Smart Cinema service account and cinema profile attribute configured.')
