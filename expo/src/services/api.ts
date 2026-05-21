import { Platform } from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

type ApiOptions = {
  token?: string | null;
};

type SendMessagePayload = {
  receiver_id: string;
  content: string;
  message_type?: "text" | "voice";
  voice_url?: string | null;
  voice_duration_ms?: number | null;
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
        return JSON.stringify(item);
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

  try {
    data = await res.json();
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

function getFileName(uri: string, fallbackExt: string = "jpg") {
  const cleanUri = uri.split("?")[0];
  const parts = cleanUri.split("/");
  const last = parts[parts.length - 1];

  if (last && last.includes(".")) {
    return last;
  }

  return `upload_${Date.now()}.${fallbackExt}`;
}

function getMimeType(uri: string) {
  const lower = uri.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

  if (lower.endsWith(".m4a")) return "audio/x-m4a";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".webm")) return "audio/webm";

  return "image/jpeg";
}

export async function apiGet(path: string, options?: ApiOptions) {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
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
      "Content-Type": "application/json",
      ...getAuthHeaders(options),
    },
    body: body ? JSON.stringify(body) : undefined,
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
      "Content-Type": "application/json",
      ...getAuthHeaders(options),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleResponse(res);
}

export async function apiDelete(path: string, options?: ApiOptions) {
  const res = await fetch(buildUrl(path), {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(options),
    },
  });

  return handleResponse(res);
}

export async function apiUploadFile(
  path: string,
  fileUri: string,
  fieldName: string = "file",
  options?: ApiOptions,
) {
  const formData = new FormData();

  const mimeType = getMimeType(fileUri);
  const isAudio = mimeType.startsWith("audio/");
  const fileName = getFileName(fileUri, isAudio ? "m4a" : "jpg");

  if (Platform.OS === "web") {
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();

    formData.append(fieldName, blob, fileName);
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
      ...getAuthHeaders(options),
    },
    body: formData,
  });

  return handleResponse(res);
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

export async function apiGetUnreadCount(options?: ApiOptions) {
  return apiGet(`/messages/unread-count?_=${Date.now()}`, options);
}