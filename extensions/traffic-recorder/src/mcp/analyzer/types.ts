/**
 * HAR (HTTP Archive) type definitions based on HAR 1.2 spec
 * @see http://www.softwareishard.com/blog/har-12-spec/
 */

export interface HARNameValuePair {
  name: string;
  value: string;
  comment?: string;
}

export interface HARHeader extends HARNameValuePair {}
export interface HARCookie extends HARNameValuePair {
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}
export interface HARQueryParam extends HARNameValuePair {}
export interface HARPostParam extends HARNameValuePair {
  fileName?: string;
  contentType?: string;
}

export interface HARPostData {
  mimeType: string;
  params?: HARPostParam[];
  text?: string;
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

export interface HARContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HARResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  content: HARContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
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

export interface HARPageTimings {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

export interface HARPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HARPageTimings;
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

export interface HARLog {
  version: string;
  creator: HARCreator;
  browser?: HARBrowser;
  pages?: HARPage[];
  entries: HAREntry[];
  comment?: string;
}

export interface HAR {
  log: HARLog;
}
