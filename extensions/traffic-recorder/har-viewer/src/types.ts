// HAR (HTTP Archive) Format Types
// Based on HAR 1.2 Spec: http://www.softwareishard.com/blog/har-12-spec/

export interface HARFile {
  log: HARLog;
}

export interface HARLog {
  version: string;
  creator: HARCreator;
  browser?: HARBrowser;
  pages?: HARPage[];
  entries: HAREntry[];
  comment?: string;
}

export interface HARCreator {
  name: string;
  version: string;
  comment?: string;
}

export interface HARBrowser {
  name: string;
  version: string;
  comment?: string;
}

export interface HARPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HARPageTimings;
  comment?: string;
}

export interface HARPageTimings {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

export interface HAREntry {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HARRequest;
  response: HARResponse;
  cache: HARCache;
  timings: HARTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

export interface HARRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  queryString: HARQueryParam[];
  postData?: HARPostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HARResponse {
  status: number;
  statusText: string | null;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  content: HARContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HARCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  comment?: string;
}

export interface HARHeader {
  name: string;
  value: string | null;
  comment?: string;
}

export interface HARQueryParam {
  name: string;
  value: string;
  comment?: string;
}

export interface HARPostData {
  mimeType: string;
  params?: HARParam[];
  text?: string;
  comment?: string;
}

export interface HARParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
}

export interface HARContent {
  size: number;
  compression?: number;
  mimeType: string | null;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HARCache {
  beforeRequest?: HARCacheEntry;
  afterRequest?: HARCacheEntry;
  comment?: string;
}

export interface HARCacheEntry {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
}

export interface HARTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
}

// UI State types
export interface HAREntryDisplay extends HAREntry {
  id: string;
  path: string;
  method: string;
  status: number;
  statusText: string;
  size: number;
  time: number;
  type: string;
}
