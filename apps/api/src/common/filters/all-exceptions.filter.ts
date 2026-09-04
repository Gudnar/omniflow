import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '@omniflow/utils';
import { AppErrorResponse, ErrorCode } from '@omniflow/types';
import { logger } from '@omniflow/utils';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      status = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (
        typeof exResponse === 'object' &&
        'message' in exResponse
      ) {
        message = Array.isArray(exResponse.message)
          ? exResponse.message[0]
          : exResponse.message;
      }

      if (exception instanceof BadRequestException) {
        code = ErrorCode.VALIDATION_ERROR;
      }
    } else if (exception instanceof Error) {
      logger.error('Unhandled exception', exception);
    }

    const errorResponse: AppErrorResponse = {
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
