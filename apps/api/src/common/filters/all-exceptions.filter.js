"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const utils_1 = require("@omniflow/utils");
const types_1 = require("@omniflow/types");
const utils_2 = require("@omniflow/utils");
let AllExceptionsFilter = class AllExceptionsFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = types_1.ErrorCode.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let details;
        if (exception instanceof utils_1.AppError) {
            status = exception.statusCode;
            code = exception.code;
            message = exception.message;
            details = exception.details;
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exResponse = exception.getResponse();
            if (typeof exResponse === 'object' &&
                'message' in exResponse) {
                message = Array.isArray(exResponse.message)
                    ? exResponse.message[0]
                    : exResponse.message;
            }
            if (exception instanceof common_1.BadRequestException) {
                code = types_1.ErrorCode.VALIDATION_ERROR;
            }
        }
        else if (exception instanceof Error) {
            utils_2.logger.error('Unhandled exception', exception);
        }
        const errorResponse = {
            error: {
                code,
                message,
                ...(details && { details }),
            },
            timestamp: new Date().toISOString(),
        };
        response.status(status).json(errorResponse);
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map