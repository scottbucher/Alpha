import { Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations-mongodb';
import { MongoDriver } from '@mikro-orm/mongodb';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Debug = require('../../config/debug.json');

process.env['MIKRO_ORM_DYNAMIC_IMPORTS'] = 'true';

const config: Options<MongoDriver> = {
    driver: MongoDriver,
    clientUrl: `mongodb://${encodeURIComponent(Config.database.username)}:${encodeURIComponent(
        Config.database.password
    )}@${Config.database.host}`,
    // clientUrl: `mongodb://${Config.database.host}`,
    dbName: Config.database.database,
    metadataProvider: TsMorphMetadataProvider,
    entities: ['./dist/database/entities/**/*.js'],
    entitiesTs: ['./src/database/entities/**/*.ts'],
    migrations: {
        path: './dist/database/migrations',
        pathTs: './src/database/migrations',
        transactional: false,
    },
    ensureIndexes: true,
    debug: Debug.logging.mikroOrm,
    extensions: [Migrator],
};

export default config;
