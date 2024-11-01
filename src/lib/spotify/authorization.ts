import { browser } from '$app/environment';
import { base } from '$app/paths';

const CONFIG = {
	client_id: '03eeb40145834b08bf90ab2233cbb70e',
	redirect_endpoint: base + '/callback',
	scope: [
		'user-read-currently-playing',
		'playlist-read-private',
		'playlist-modify-private',
		'playlist-modify-public',
		'ugc-image-upload'
	]
};

export const login = async (): Promise<void> => {
	const code_verifier = generateRandomString(64);
	toLocalStorage('code_verifier', code_verifier);
	const hashed = await sha256(code_verifier);
	const code_challenge = base64Encode(hashed);
	const params = {
		response_type: 'code',
		client_id: CONFIG.client_id,
		scope: CONFIG.scope.join(' '),
		code_challenge_method: 'S256',
		code_challenge: code_challenge,
		redirect_uri: window.location.origin + CONFIG.redirect_endpoint
	};
	const auth_url = new URL('https://accounts.spotify.com/authorize');
	auth_url.search = new URLSearchParams(params).toString();
	toLocalStorage('redirect_uri', window.location.href);
	window.location.replace(auth_url.toString());
};

export const handleCallback = async () => {
	console.log('Fetching access token');
	let code_verifier = fromLocalStorage('code_verifier');
	if (!code_verifier) {
		throw new Error('No code verifier');
	}
	const url = new URL(window.location.href);
	const code = url.searchParams.get('code');
	if (!code) {
		throw new Error('No code');
	}
	const response = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			client_id: CONFIG.client_id,
			grant_type: 'authorization_code',
			code: code,
			redirect_uri: window.location.origin + CONFIG.redirect_endpoint,
			code_verifier: code_verifier
		})
	});
	const body = await response.json();
	if (response.status != 200) {
		throw new Error('Failed to fetch access token');
	}
	const access_token = body.access_token;
	const refresh_token = body.refresh_token;
	if (!access_token || !refresh_token) {
		throw new Error('Reponse did not contain access token and refresh token');
	}
	const expires_at = Date.now() + 1000 * body.expires_in;
	console.log('saving access tokens');
	console.log(access_token, expires_at, refresh_token);

	toLocalStorage('access_token', access_token);
	toLocalStorage('expires_at', expires_at.toString());
	toLocalStorage('refresh_token', refresh_token);
	window.location.replace(fromLocalStorage('redirect_uri') || '/');
};

export const getAccessToken = async (): Promise<string | null> => {
	const access_token = fromLocalStorage('access_token');
	const expires_at = fromLocalStorage('expires_at');
	if (!access_token) {
		console.log('No access token');
		return null;
	}
	if (!expires_at) {
		console.log('No expires at');
		return null;
	}
	if (Date.now() > Number(expires_at)) {
		console.log('Access token expired');
		await refreshAccessToken();
		return getAccessToken();
	}
	return access_token;
};

export const logout = () => {
	localStorage.removeItem('access_token');
	localStorage.removeItem('expires_at');
	localStorage.removeItem('refresh_token');
};

const toLocalStorage = (key: string, value: string) => {
	if (!browser) {
		return;
	}
	localStorage.setItem(key, value);
};

const fromLocalStorage = (key: string): string | null => {
	if (!browser) {
		return null;
	}
	return localStorage.getItem(key);
};

const generateRandomString = (length: number) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return crypto.subtle.digest('SHA-256', data);
};

const base64Encode = (input: ArrayBuffer) => {
	return btoa(String.fromCharCode(...new Uint8Array(input)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
};

const refreshAccessToken = async () => {
	console.log('refreshing acess token');
	const refresh_token = fromLocalStorage('refresh_token') as string;
	console.log(refresh_token);

	const url = 'https://accounts.spotify.com/api/token';
	const payload = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refresh_token,
			client_id: CONFIG.client_id
		})
	};
	const body = await fetch(url, payload);
	const response = await body.json();
	const expires_at = Date.now() + 1000 * response.expires_in;
	toLocalStorage('access_token', response.access_token);
	toLocalStorage('expires_at', expires_at.toString());
	toLocalStorage('refresh_token', response.refresh_token);
};
