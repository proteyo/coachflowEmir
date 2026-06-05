import { Platform } from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export type ApiOptions = {
  token?: string | null;
};

export type UploadOptions = ApiOptions & {
  mimeType?: string | null;
  fileName?: string | null;
};

export type MessageType = "text" | "voice" | "image" | "video";
export type MediaType = "image" | "video";
export type DeleteMessageMode = "me" | "everyone";

export type SendMessagePayload = {
  receiver_id: string;

  // Защита от дублей.
  client_temp_id?: string | null;

  content: string;
  message_type?: MessageType;

  // Ответ на сообщение.
  reply_to_id?: string | null;

  // Voice
  voice_url?: string | null;
  voice_duration_ms?: number | null;

  // Image / video
  media_url?: string | null;
  media_type?: MediaType | null;
  media_thumbnail_url?: string | null;
};

export type EditMessagePayload = {
  content: string;
};

export type ReactToMessagePayload = {
  emoji: string;
};

export type PinMessagePayload = {
  pinned: boolean;
};

export type ForwardMessagePayload = {
  receiver_id: string;
};

function buildUrl(path: string) {
  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}

function getErrorMessage(data: any, status: number) {
  const detail = data?.detail ?? data?.message;

  if (!detail) {
    return `Request failed with status ${status}`;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return item.msg;

        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join("\n");
  }

  try {
    return JSON.stringify(detail);
  } catch {
    return `Request failed with status ${status}`;
  }
}

async function handleResponse(res: Response) {
  let data: any = null;
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { detail: text } : null;
    }
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(getErrorMessage(data, res.status));
  }

  return data;
}

function getAuthHeaders(options?: ApiOptions) {
  return {
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
}

export function toAbsoluteUrl(url?: string | null) {
  if (!url) return undefined;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_ORIGIN}${url}`;
  }

  return url;
}

function getExtensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("heic") || normalized.includes("heif")) return "jpg";

  if (normalized.includes("mp4") && normalized.startsWith("video")) return "mp4";
  if (normalized.includes("quicktime")) return "mov";
  if (normalized.includes("webm") && normalized.startsWith("video")) return "webm";

  if (normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mp4") && normalized.startsWith("audio")) return "m4a";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("webm") && normalized.startsWith("audio")) return "webm";

  return "bin";
}

function getFileName(
  uri: string,
  fallbackExt: string = "jpg",
  explicitName?: string | null,
) {
  if (explicitName && explicitName.trim()) {
    return explicitName.trim();
  }

  const cleanUri = uri.split("?")[0];
  const parts = cleanUri.split("/");
  const last = parts[parts.length - 1];

  if (last && last.includes(".")) {
    return last;
  }

  return `upload_${Date.now()}.${fallbackExt}`;
}

function getMimeType(
  uri: string,
  path?: string,
  explicitMimeType?: string | null,
) {
  if (explicitMimeType && explicitMimeType.trim()) {
    return explicitMimeType.trim();
  }

  const lower = uri.toLowerCase();
  const cleanPath = String(path ?? "").toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/jpeg";

  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm") && cleanPath.includes("video")) return "video/webm";

  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".webm")) return "audio/webm";

  if (
    cleanPath.includes("/uploads/video-thumbnail") ||
    cleanPath.includes("/video-thumbnail") ||
    cleanPath.includes("/video-thumbnails")
  ) {
    return "image/jpeg";
  }

  if (cleanPath.includes("/uploads/video") || cleanPath.includes("/video")) {
    return "video/mp4";
  }

  if (cleanPath.includes("/uploads/voice") || cleanPath.includes("/voice")) {
    return "audio/mp4";
  }

  if (cleanPath.includes("/uploads/image") || cleanPath.includes("/image")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function normalizeUploadResponse(data: any) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const mediaUrl =
    data.mediaUrl ??
    data.media_url ??
    data.imageUrl ??
    data.image_url ??
    data.videoUrl ??
    data.video_url ??
    data.voiceUrl ??
    data.voice_url ??
    data.publicUrl ??
    data.public_url ??
    data.url ??
    null;

  const thumbnailUrl =
    data.mediaThumbnailUrl ??
    data.media_thumbnail_url ??
    data.thumbnailUrl ??
    data.thumbnail_url ??
    null;

  return {
    ...data,

    url: data.url ?? mediaUrl,

    mediaUrl: data.mediaUrl ?? data.media_url ?? mediaUrl,
    media_url: data.media_url ?? data.mediaUrl ?? mediaUrl,

    voiceUrl: data.voiceUrl ?? data.voice_url ?? mediaUrl,
    voice_url: data.voice_url ?? data.voiceUrl ?? mediaUrl,

    imageUrl: data.imageUrl ?? data.image_url ?? mediaUrl,
    image_url: data.image_url ?? data.imageUrl ?? mediaUrl,

    videoUrl: data.videoUrl ?? data.video_url ?? mediaUrl,
    video_url: data.video_url ?? data.videoUrl ?? mediaUrl,

    publicUrl: data.publicUrl ?? data.public_url ?? mediaUrl,
    public_url: data.public_url ?? data.publicUrl ?? mediaUrl,

    mediaThumbnailUrl:
      data.mediaThumbnailUrl ?? data.media_thumbnail_url ?? thumbnailUrl,
    media_thumbnail_url:
      data.media_thumbnail_url ?? data.mediaThumbnailUrl ?? thumbnailUrl,
    thumbnailUrl: data.thumbnailUrl ?? data.thumbnail_url ?? thumbnailUrl,
    thumbnail_url: data.thumbnail_url ?? data.thumbnailUrl ?? thumbnailUrl,
  };
}

export async function apiGet(path: string, options?: ApiOptions) {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(options),
    },
  });

  return handleResponse(res);
}

export async function apiPost(
  path: string,
  body?: unknown,
  options?: ApiOptions,
) {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(options),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse(res);
}

export async function apiPatch(
  path: string,
  body?: unknown,
  options?: ApiOptions,
) {
  const res = await fetch(buildUrl(path), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(options),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse(res);
}

export async function apiDelete(path: string, options?: ApiOptions) {
  const res = await fetch(buildUrl(path), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(options),
    },
  });

  return handleResponse(res);
}

export async function apiUploadFile(
  path: string,
  fileUri: string,
  fieldName: string = "file",
  options?: UploadOptions,
) {
  if (!fileUri) {
    throw new Error("File URI is required");
  }

  const formData = new FormData();

  const mimeType = getMimeType(fileUri, path, options?.mimeType);
  const fallbackExt = getExtensionFromMimeType(mimeType);
  const fileName = getFileName(fileUri, fallbackExt, options?.fileName);

  if (Platform.OS === "web") {
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();

    const file =
      typeof File !== "undefined"
        ? new File([blob], fileName, { type: mimeType })
        : blob;

    formData.append(fieldName, file as any, fileName);
  } else {
    formData.append(fieldName, {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
  }

  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(options),
    },
    body: formData,
  });

  const data = await handleResponse(res);

  return normalizeUploadResponse(data);
}

/**
 * Chat API helpers
 */

export async function apiGetMessages(
  partnerId: string,
  options?: ApiOptions & {
    markAsRead?: boolean;
  },
) {
  const markAsRead = options?.markAsRead ?? true;

  const query = new URLSearchParams({
    partner_id: partnerId,
    mark_as_read: markAsRead ? "true" : "false",
    _: String(Date.now()),
  });

  return apiGet(`/messages?${query.toString()}`, options);
}

export async function apiSendMessage(
  payload: SendMessagePayload,
  options?: ApiOptions,
) {
  return apiPost("/messages", payload, options);
}

export async function apiMarkConversationRead(
  partnerId: string,
  options?: ApiOptions,
) {
  const query = new URLSearchParams({
    partner_id: partnerId,
    _: String(Date.now()),
  });

  return apiPost(`/messages/read-conversation?${query.toString()}`, {}, options);
}

export async function apiMarkMessageRead(
  messageId: string,
  options?: ApiOptions,
) {
  return apiPost(`/messages/${messageId}/read`, {}, options);
}

export async function apiEditMessage(
  messageId: string,
  payload: EditMessagePayload,
  options?: ApiOptions,
) {
  return apiPatch(`/messages/${messageId}`, payload, options);
}

export async function apiReactToMessage(
  messageId: string,
  payload: ReactToMessagePayload,
  options?: ApiOptions,
) {
  return apiPost(`/messages/${messageId}/reaction`, payload, options);
}

export async function apiPinMessage(
  messageId: string,
  payload: PinMessagePayload,
  options?: ApiOptions,
) {
  return apiPost(`/messages/${messageId}/pin`, payload, options);
}

export async function apiForwardMessage(
  messageId: string,
  payload: ForwardMessagePayload,
  options?: ApiOptions,
) {
  return apiPost(`/messages/${messageId}/forward`, payload, options);
}

export async function apiDeleteMessage(
  messageId: string,
  mode: DeleteMessageMode = "everyone",
  options?: ApiOptions,
) {
  const query = new URLSearchParams({
    mode,
  });

  return apiDelete(`/messages/${messageId}?${query.toString()}`, options);
}

export async function apiDeleteMessageFallback(
  messageId: string,
  mode: DeleteMessageMode = "everyone",
  options?: ApiOptions,
) {
  const query = new URLSearchParams({
    mode,
  });

  return apiPost(`/messages/${messageId}/delete?${query.toString()}`, {}, options);
}

export async function apiGetUnreadCount(options?: ApiOptions) {
  return apiGet(`/messages/unread-count?_=${Date.now()}`, options);
}

/**
 * Upload helpers
 */

export async function apiUploadVoice(
  fileUri: string,
  options?: UploadOptions,
) {
  return apiUploadFile("/uploads/voice", fileUri, "file", {
    ...options,
    mimeType: options?.mimeType ?? "audio/mp4",
    fileName: options?.fileName ?? `voice_${Date.now()}.m4a`,
  });
}

export async function apiUploadChatImage(
  fileUri: string,
  options?: UploadOptions,
) {
  return apiUploadFile("/uploads/image", fileUri, "file", {
    ...options,
    mimeType: options?.mimeType ?? "image/jpeg",
    fileName: options?.fileName ?? `image_${Date.now()}.jpg`,
  });
}

export async function apiUploadChatVideo(
  fileUri: string,
  options?: UploadOptions,
) {
  return apiUploadFile("/uploads/video", fileUri, "file", {
    ...options,
    mimeType: options?.mimeType ?? "video/mp4",
    fileName: options?.fileName ?? `video_${Date.now()}.mp4`,
  });
}

export async function apiUploadVideoThumbnail(
  fileUri: string,
  options?: UploadOptions,
) {
  return apiUploadFile("/uploads/video-thumbnail", fileUri, "file", {
    ...options,
    mimeType: options?.mimeType ?? "image/jpeg",
    fileName: options?.fileName ?? `video_thumb_${Date.now()}.jpg`,
  });
}

export function getConfiguredApiBaseUrl() {
  return API_BASE_URL;
}

export function getConfiguredApiOrigin() {
  return API_ORIGIN;
}