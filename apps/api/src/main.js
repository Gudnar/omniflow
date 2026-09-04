"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const utils_1 = require("@omniflow/utils");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const port = process.env.PORT || 3000;
    await app.listen(port);
    utils_1.logger.info(`API server listening on port ${port}`);
}
bootstrap().catch((error) => {
    utils_1.logger.error('Failed to start API server', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map