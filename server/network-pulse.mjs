// Author: Tommy
import { createHash } from 'node:crypto';

export class NetworkPulse {
  constructor(rpc) { this.rpc = rpc; }

  async collect() {
    const blocks = [];
    let block = await this.rpc.call('block', { finality: 'final' });
    for (let index = 0; index < 6; index++) {
      if (!block?.header?.hash || !Number.isSafeInteger(block.header.height) || !Array.isArray(block.chunks)) throw new Error('Invalid block response.');
      const timestamp = block.header.timestamp_nanosec ?? String(block.header.timestamp);
      if (!/^\d+$/.test(timestamp) || !/^\d+$/.test(block.header.gas_price)) throw new Error('Invalid block values.');
      const chunks = block.chunks.filter(chunk => chunk.height_included === block.header.height);
      if (chunks.some(chunk => !Number.isSafeInteger(chunk.gas_used) || !Number.isSafeInteger(chunk.gas_limit))) throw new Error('Unsafe chunk gas value.');
      blocks.push({ height: block.header.height, hash: block.header.hash, previousHash: block.header.prev_hash,
        timestampNanoseconds: timestamp, gasPriceYocto: block.header.gas_price,
        includedChunks: chunks.length, gasUsed: chunks.reduce((sum, chunk) => sum + BigInt(chunk.gas_used), 0n).toString(),
        gasLimit: chunks.reduce((sum, chunk) => sum + BigInt(chunk.gas_limit), 0n).toString() });
      if (index < 5) block = await this.rpc.call('block', { block_id: block.header.prev_hash });
    }
    const intervals = blocks.slice(0, -1).map((block, index) => {
      const older = blocks[index + 1];
      if (block.previousHash !== older.hash || block.height <= older.height) throw new Error('Block sample is not linked.');
      const milliseconds = Number((BigInt(block.timestampNanoseconds) - BigInt(older.timestampNanoseconds)) / 1000000n);
      if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw new Error('Invalid block interval.');
      return milliseconds;
    });
    const gasUsed = blocks.reduce((sum, block) => sum + BigInt(block.gasUsed), 0n);
    const gasLimit = blocks.reduce((sum, block) => sum + BigInt(block.gasLimit), 0n);
    const data = { title: 'NEAR Mainnet Pulse', network: 'mainnet', observedAt: new Date().toISOString(),
      source: this.rpc.endpoint, method: 'Six hash-linked finalized blocks; included chunk headers only.', blocks,
      metrics: { blocks: blocks.length, firstHeight: blocks.at(-1).height, lastHeight: blocks[0].height,
        meanBlockIntervalMs: Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length),
        maxBlockIntervalMs: Math.max(...intervals), includedChunks: blocks.reduce((sum, block) => sum + block.includedChunks, 0),
        sampledChunkGasUsedTgas: (gasUsed / 1000000000000n).toString(),
        sampledChunkGasCapacityPercent: gasLimit > 0n ? Number(gasUsed * 10000n / gasLimit) / 100 : null },
      limitations: ['Six blocks are a short observation window, not a trend.', 'Chunk-header gas is not transaction throughput or active-user count.',
        'Public RPC data is aggregated by our demo supplier; this is not an independent commercial data vendor.', 'Only payment uses testnet; observations are read from mainnet.'] };
    return { ...data, sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
  }
}
