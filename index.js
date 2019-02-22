const ytdl = require('ytdl-core');
const prism = require('prism-media');

function filter(format) {
	return format.audioEncoding === 'opus' &&
		format.container === 'webm' &&
		format.audio_sample_rate == 48000;
}

let result = {};
result.downloadFromInfo = function(info, options = {}) {
	// Prefer opus
	const canDemux = info.formats.find(filter) && info.length_seconds != 0;
	if (canDemux) Object.assign(options, { filter });
	else if (info.length_seconds != 0) Object.assign(options, { filter: 'audioonly' });
	options.highWaterMark = 10e6;
	const ytdlStream = ytdl.downloadFromInfo(info, options);
	if (canDemux) {
		const demuxer = new prism.opus.WebmDemuxer();
		return ytdlStream.pipe(demuxer).on('end', () => demuxer.destroy());
	} else {
		const transcoder = new prism.FFmpeg({
			args: [
				'-analyzeduration', '0',
				'-loglevel', '0',
				'-f', 's16le',
				'-ar', '48000',
				'-ac', '2',
			],
		});
		const opus = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
		const stream = ytdlStream.pipe(transcoder).pipe(opus);
		stream.on('close', () => {
			transcoder.destroy();
			opus.destroy();
		});
		return stream;
	}
}
result.download = function(url, options = {}) {
	return new Promise((resolve, reject) => {
		try {
			ytdl.getInfo(url, (err, info) => {
				if (err) return reject(err);
				return resolve(result.downloadFromInfo(info, options));
			});
		} catch (e) {
			return reject(e);
		}
	});
};
module.exports = result;