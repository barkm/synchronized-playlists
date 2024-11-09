import { getAccessToken } from './authorization';

export class NoAccessError extends Error {}

export const isLoggedIn = async (): Promise<boolean> => {
	return (await getAccessToken()) !== null;
};

export interface User {
	id: string;
	display_name: string;
}

export const getUser = async (): Promise<User> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch('https://api.spotify.com/v1/me', {
		headers: {
			Authorization: `Bearer ${access_token}`
		}
	});
	if (response.status == 403) {
		throw new NoAccessError();
	}
	if (response.status != 200) {
		throw new Error('Failed to fetch user');
	}
	return await response.json();
};

export interface Playlist {
	id: string;
	name: string;
	description: string;
	cover?: CoverImage;
	spotify_url: string;
}

export const getPlaylist = async (playlist_id: string): Promise<Playlist> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}`, {
		headers: {
			Authorization: `Bearer ${access_token}`
		}
	});
	if (response.status != 200) {
		throw new Error('Failed to fetch playlist');
	}
	const body = await response.json();
	const cover = body.images.length > 0 ? body.images[body.images.length - 1] : null;
	return {
		id: body.id,
		name: body.name,
		description: body.description,
		cover: cover,
		spotify_url: body.external_urls.spotify
	};
};

export const getPlaylists = async (): Promise<Playlist[]> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	let playlists: Playlist[] = [];
	let url = 'https://api.spotify.com/v1/me/playlists';
	while (url) {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${access_token}`
			}
		});
		if (response.status != 200) {
			throw new Error('Failed to fetch playlists');
		}
		const body = await response.json();
		const new_playlists: Playlist[] = body.items.map(
			(item: any): Playlist => ({
				id: item.id,
				name: item.name,
				description: item.description,
				cover: item.images?.length > 0 ? item.images[item.images.length - 1] : null,
				spotify_url: item.external_urls.spotify
			})
		);
		playlists = playlists.concat(new_playlists);
		url = body.next;
	}
	return playlists;
};

export const createPlaylist = async (
	name: string,
	is_public: boolean,
	description: string
): Promise<Playlist> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const user = await getUser();
	const response = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name: name,
			public: is_public,
			description: description
		})
	});
	if (response.status != 201) {
		throw new Error('Failed to create playlist');
	}
	const body = await response.json();
	return {
		id: body.id,
		name: body.name,
		description: body.description,
		spotify_url: body.external_urls.spotify
	};
};

export const unfollowPlaylist = async (playlist_id: string): Promise<void> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/followers`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${access_token}`
		}
	});
	if (response.status != 200) {
		throw new Error('Failed to unfollow playlist');
	}
};

export interface Track {
	uri: string;
	name: string;
}

export const getTracks = async (playlist_id: string): Promise<Track[]> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	let url = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;
	let tracks: Track[] = [];
	while (url) {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${access_token}`
			}
		});
		if (response.status != 200) {
			throw new Error('Failed to fetch tracks');
		}
		const body = await response.json();
		url = body.next;
		tracks = tracks.concat(
			body.items.map((item: any) => ({
				uri: item.track.uri,
				name: item.track.name
			}))
		);
	}
	return tracks;
};

export const addTracks = async (playlist_id: string, track_uris: string[]): Promise<void> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const track_uris_chunks = chunkArray(track_uris, 100);
	for (const chunk of track_uris_chunks) {
		await addTracksChunk(playlist_id, chunk);
	}
};

const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		result.push(array.slice(i, i + chunkSize));
	}
	return result;
};

const addTracksChunk = async (playlist_id: string, track_uris: string[]): Promise<void> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			uris: track_uris
		})
	});
	if (response.status != 201) {
		throw new Error('Failed to add tracks');
	}
};

export const replaceTracks = async (playlist_id: string, track_uris: string[]): Promise<void> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${access_token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			uris: []
		})
	});
	if (response.status != 201 && response.status != 200) {
		throw new Error('Failed to replace tracks');
	}
	await addTracks(playlist_id, track_uris);
};

export const addPlaylistCoverImage = async (
	playlist_id: string,
	image_data: string
): Promise<void> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/images`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${access_token}`,
			'Content-Type': 'image/jpeg'
		},
		body: image_data
	});
	if (response.status != 202) {
		throw new Error('Failed to add cover image');
	}
};

export interface CoverImage {
	url: string;
	width: number | null;
	height: number | null;
}

export const getPlaylistCoverImage = async (
	playlist_id: string
): Promise<CoverImage | undefined> => {
	const access_token = await getAccessToken();
	if (!access_token) {
		throw new Error('No access token');
	}
	const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/images`, {
		headers: {
			Authorization: `Bearer ${access_token}`
		}
	});
	if (response.status != 200) {
		throw new Error('Failed to fetch cover image');
	}
	const images = await response.json();
	if (images.length == 0) {
		return undefined;
	}
	const image = images[images.length - 1];
	return {
		url: image.url,
		width: image.width,
		height: image.height
	};
};
