import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';

export async function pickAndUploadImage(folder: string): Promise<string> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Permission to access photos is required.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });

  if (result.canceled || !result.assets[0]) throw new Error('No image selected.');

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? 'photo.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as any);
  formData.append('folder', folder);

  const res = await client.post<{ url: string }>('/auth/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}

export async function takeAndUploadPhoto(folder: string): Promise<string> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Permission to use camera is required.');

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.6,
  });

  if (result.canceled || !result.assets[0]) throw new Error('No photo taken.');

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);
  formData.append('folder', folder);

  const res = await client.post<{ url: string }>('/auth/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}
