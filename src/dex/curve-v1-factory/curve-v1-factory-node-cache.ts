import NodeCache from 'node-cache';

/*
 * First I wanted to make it global, but since I am applying only CurveV1Factory
 * related configs, I decided to move it into this folder
 * Keep keys only one hour.
 * Be careful when storing complex data
 * In this implementation I expect to keep only simple variables
 */
export default new NodeCache({ stdTTL: 3600, useClones: false });
