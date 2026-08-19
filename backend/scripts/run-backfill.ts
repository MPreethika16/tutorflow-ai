import { NestFactory } from '@nestjs/core';
import { EmbeddingBackfillService } from '../src/ai/embedding-backfill.service';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const backfillService = app.get(EmbeddingBackfillService);
  
  console.log('Starting backfill...');
  const result = await backfillService.backfillEmbeddings();
  console.log('Backfill complete:', result);

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
