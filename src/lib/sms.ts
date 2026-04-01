import crypto from "node:crypto";

const API_ENDPOINT = "https://dysmsapi.aliyuncs.com";
const API_VERSION = "2017-05-25";
const SIGNATURE_METHOD = "HMAC-SHA1";
const SIGNATURE_VERSION = "1.0";

interface AliyunSmsResponse {
  Code: string;
  Message: string;
  RequestId: string;
  BizId?: string;
}

function getConfig() {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  const signLinkTemplateCode = process.env.ALIYUN_SMS_SIGN_LINK_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !signName) {
    throw new Error(
      "Missing required Aliyun SMS env vars: ALIYUN_SMS_ACCESS_KEY_ID, ALIYUN_SMS_ACCESS_KEY_SECRET, ALIYUN_SMS_SIGN_NAME",
    );
  }

  return { accessKeyId, accessKeySecret, signName, templateCode, signLinkTemplateCode };
}

/**
 * Percent-encode a string following Aliyun's rules:
 * RFC 3986 with additional encoding of '~'.
 */
function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/**
 * Build and sign an Aliyun SMS API request, then send it.
 * Uses the common request signature method (V1 / HMAC-SHA1).
 */
async function callSmsApi(
  action: string,
  templateCode: string,
  phoneNumbers: string,
  templateParam: Record<string, string>,
  accessKeyId: string,
  accessKeySecret: string,
  signName: string,
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // Base parameters (must be sorted alphabetically for signing)
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: action,
    Format: "JSON",
    PhoneNumbers: phoneNumbers,
    SignName: signName,
    SignatureMethod: SIGNATURE_METHOD,
    SignatureNonce: nonce,
    SignatureVersion: SIGNATURE_VERSION,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify(templateParam),
    Timestamp: timestamp,
    Version: API_VERSION,
  };

  // Step 1: Sort params and build the canonical query string
  const sortedKeys = Object.keys(params).sort();
  const canonicalQueryString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k] ?? "")}`)
    .join("&");

  // Step 2: Build the string-to-sign
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalQueryString)}`;

  // Step 3: HMAC-SHA1 sign (key must have trailing '&')
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  // Step 4: Append signature and send
  const finalParams = new URLSearchParams({
    ...params,
    Signature: signature,
  });

  const url = `${API_ENDPOINT}/?${finalParams.toString()}`;
  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(
      `Aliyun SMS HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  const data: AliyunSmsResponse = (await response.json()) as AliyunSmsResponse;

  if (data.Code !== "OK") {
    throw new Error(
      `Aliyun SMS API error: [${data.Code}] ${data.Message} (RequestId: ${data.RequestId})`,
    );
  }
}

/**
 * Send a verification code SMS to a driver's phone number.
 * Uses ALIYUN_SMS_TEMPLATE_CODE — expected template variable: ${code}
 */
export async function sendVerificationCode(
  phone: string,
  code: string,
): Promise<void> {
  const { accessKeyId, accessKeySecret, signName, templateCode } = getConfig();

  if (!templateCode) {
    throw new Error(
      "Missing required env var: ALIYUN_SMS_TEMPLATE_CODE",
    );
  }

  await callSmsApi(
    "SendSms",
    templateCode,
    phone,
    { code },
    accessKeyId,
    accessKeySecret,
    signName,
  );
}

export interface SignLinkParams {
  customerName: string;
  orderNo: string;
  signUrl: string;
}

/**
 * Send a signing link SMS to a customer.
 * Uses ALIYUN_SMS_SIGN_LINK_TEMPLATE_CODE — expected template variables:
 * ${customerName}, ${orderNo}, ${signUrl}
 */
export async function sendSignLink(
  phone: string,
  params: SignLinkParams,
): Promise<void> {
  const { accessKeyId, accessKeySecret, signName, signLinkTemplateCode } =
    getConfig();

  if (!signLinkTemplateCode) {
    throw new Error(
      "Missing required env var: ALIYUN_SMS_SIGN_LINK_TEMPLATE_CODE",
    );
  }

  await callSmsApi(
    "SendSms",
    signLinkTemplateCode,
    phone,
    {
      customerName: params.customerName,
      orderNo: params.orderNo,
      signUrl: params.signUrl,
    },
    accessKeyId,
    accessKeySecret,
    signName,
  );
}
