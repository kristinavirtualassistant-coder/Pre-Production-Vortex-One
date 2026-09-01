/**
 * Vortex One - Google Drive Client API Service (v3)
 */

import { getAccessToken } from './driveAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string; photoLink?: string }>;
  shared?: boolean;
  starred?: boolean;
  parents?: string[];
  capabilities?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canDownload?: boolean;
  };
}

export interface DriveAboutInfo {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
}

async function getAuthorizedHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Drive authorization required. Please sign in with Google.');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const driveService = {
  /**
   * Get user about & storage quota details
   */
  async getAbout(): Promise<DriveAboutInfo> {
    const headers = await getAuthorizedHeaders();
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota',
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Drive information: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * List files within a folder or root Drive
   */
  async listFiles(options: {
    folderId?: string;
    query?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
  } = {}): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
    const headers = await getAuthorizedHeaders();
    const { folderId = 'root', query, pageSize = 30, pageToken, orderBy = 'folder,modifiedTime desc' } = options;

    let qParts: string[] = ['trashed = false'];

    if (query && query.trim()) {
      const escaped = query.replace(/'/g, "\\'");
      qParts.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
    } else {
      qParts.push(`'${folderId}' in parents`);
    }

    const q = qParts.join(' and ');
    const params = new URLSearchParams({
      q,
      pageSize: String(pageSize),
      orderBy,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, iconLink, thumbnailLink, webViewLink, webContentLink, owners, shared, starred, parents, capabilities)',
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to list files: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Create a new folder
   */
  async createFolder(name: string, parentId: string = 'root'): Promise<DriveFileItem> {
    const headers = await getAuthorizedHeaders();
    const body = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root'],
    };

    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,createdTime', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create folder: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Get an existing folder by name or create it if it does not exist
   */
  async getOrCreateFolder(name: string, parentId: string = 'root'): Promise<{ folder: DriveFileItem; created: boolean }> {
    const headers = await getAuthorizedHeaders();
    const escaped = name.replace(/'/g, "\\'");
    const parentQuery = parentId ? `'${parentId}' in parents and ` : '';
    const q = `${parentQuery}mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}' and trashed = false`;
    const params = new URLSearchParams({
      q,
      pageSize: '1',
      fields: 'files(id, name, mimeType, webViewLink, createdTime, parents)',
    });

    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return { folder: data.files[0], created: false };
      }
    }

    const createdFolder = await this.createFolder(name, parentId);
    return { folder: createdFolder, created: true };
  },

  /**
   * Upload a raw file (binary or text) using multipart upload
   */
  async uploadFile(file: File, parentId: string = 'root'): Promise<DriveFileItem> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authorization required');

    const metadata = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      parents: parentId ? [parentId] : ['root'],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileReader = new FileReader();

    const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
      fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsArrayBuffer(file);
    });

    const fileBuffer = await fileDataPromise;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}`;
    const mediaHeader = `${delimiter}Content-Type: ${metadata.mimeType}\r\n\r\n`;

    const enc = new TextEncoder();
    const metaBytes = enc.encode(metadataPart);
    const mediaHeaderBytes = enc.encode(mediaHeader);
    const closeBytes = enc.encode(closeDelimiter);

    const totalLength = metaBytes.length + mediaHeaderBytes.length + fileBuffer.byteLength + closeBytes.length;
    const bodyUint8 = new Uint8Array(totalLength);

    let offset = 0;
    bodyUint8.set(metaBytes, offset);
    offset += metaBytes.length;
    bodyUint8.set(mediaHeaderBytes, offset);
    offset += mediaHeaderBytes.length;
    bodyUint8.set(new Uint8Array(fileBuffer), offset);
    offset += fileBuffer.byteLength;
    bodyUint8.set(closeBytes, offset);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyUint8,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `File upload failed: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Create a text/markdown/document file in Drive with text content
   */
  async createDocument(name: string, content: string, mimeType: string = 'text/plain', parentId: string = 'root'): Promise<DriveFileItem> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authorization required');

    const metadata = {
      name,
      mimeType,
      parents: parentId ? [parentId] : ['root'],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}`;
    const mediaHeader = `${delimiter}Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n`;

    const enc = new TextEncoder();
    const metaBytes = enc.encode(metadataPart);
    const mediaHeaderBytes = enc.encode(mediaHeader);
    const contentBytes = enc.encode(content);
    const closeBytes = enc.encode(closeDelimiter);

    const totalLength = metaBytes.length + mediaHeaderBytes.length + contentBytes.length + closeBytes.length;
    const bodyUint8 = new Uint8Array(totalLength);

    let offset = 0;
    bodyUint8.set(metaBytes, offset);
    offset += metaBytes.length;
    bodyUint8.set(mediaHeaderBytes, offset);
    offset += mediaHeaderBytes.length;
    bodyUint8.set(contentBytes, offset);
    offset += contentBytes.length;
    bodyUint8.set(closeBytes, offset);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyUint8,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create file: ${res.statusText}`);
    }

    return await res.json();
  },

  /**
   * Delete a file or move to trash (Destructive operation - MUST require UI confirmation before calling)
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const headers = await getAuthorizedHeaders();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to delete file: ${res.statusText}`);
    }

    return true;
  },

  /**
   * Fetch file content (e.g. text/json files)
   */
  async getFileContent(fileId: string): Promise<string> {
    const headers = await getAuthorizedHeaders();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to download file content: ${res.statusText}`);
    }

    return await res.text();
  },
};
