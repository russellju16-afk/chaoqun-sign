import { NextResponse } from "next/server";

interface ErrorBody {
  readonly error: string;
  readonly message: string;
}

function errorResponse(
  error: string,
  message: string,
  status: number,
): NextResponse<ErrorBody> {
  return NextResponse.json({ error, message }, { status });
}

export function badRequest(message = "请求参数错误"): NextResponse<ErrorBody> {
  return errorResponse("BAD_REQUEST", message, 400);
}

export function unauthorized(
  message = "未登录或会话已过期",
): NextResponse<ErrorBody> {
  return errorResponse("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "权限不足"): NextResponse<ErrorBody> {
  return errorResponse("FORBIDDEN", message, 403);
}

export function notFound(message = "资源不存在"): NextResponse<ErrorBody> {
  return errorResponse("NOT_FOUND", message, 404);
}

export function serverError(
  message = "服务器内部错误",
): NextResponse<ErrorBody> {
  return errorResponse("INTERNAL_SERVER_ERROR", message, 500);
}
