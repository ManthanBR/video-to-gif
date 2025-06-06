const { createFFmpeg, fetchFile } = FFmpeg; // FFmpeg is globally available from the CDN script
let ffmpeg; // Declare ffmpeg instance globally

// DOM Elements
const videoFileInput = document.getElementById('videoFile');
const convertToGifButton = document.getElementById('convertToGifButton');
const startTimeInput = document.getElementById('startTime');
const durationInput = document.getElementById('duration');
const fpsInput = document.getElementById('fps');
const scaleWidthInput = document.getElementById('scaleWidth');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const gifPreview = document.getElementById('gifPreview');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;

// Initialize FFmpeg
async function initFFmpeg() {
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        statusMessage.textContent = 'Loading FFmpeg-core.js...';
        progressBar.style.display = 'block';
        progressBar.value = 0;
        ffmpeg = createFFmpeg({
            log: true, // Enable logging for debugging
            progress: ({ ratio }) => {
                progressBar.value = ratio * 100;
                if (ratio === 1) {
                    statusMessage.textContent = 'Processing complete. Finalizing GIF...';
                } else if (ratio > 0) {
                    statusMessage.textContent = `Processing... ${Math.round(ratio * 100)}%`;
                }
            },
        });
        await ffmpeg.load();
        statusMessage.textContent = 'FFmpeg loaded. Ready to convert.';
        progressBar.style.display = 'none';
    }
}

// Event Listener for File Input
videoFileInput.addEventListener('change', async (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        convertToGifButton.disabled = false;
        statusMessage.textContent = `Selected: ${selectedFile.name}. Click convert!`;
        gifPreview.style.display = 'none';
        downloadLink.style.display = 'none';
        await initFFmpeg(); // Load ffmpeg if not already loaded
    } else {
        convertToGifButton.disabled = true;
        statusMessage.textContent = 'Select a video to begin.';
    }
});

// Event Listener for Convert Button
convertToGifButton.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('Please select a video file first.');
        return;
    }
    if (!ffmpeg || !ffmpeg.isLoaded()) {
        statusMessage.textContent = 'FFmpeg not loaded. Please wait or refresh.';
        await initFFmpeg(); // Try to load again
        if (!ffmpeg.isLoaded()) return; // Still not loaded, exit
    }

    convertToGifButton.disabled = true;
    statusMessage.textContent = 'Starting conversion...';
    progressBar.style.display = 'block';
    progressBar.value = 0;
    gifPreview.style.display = 'none';
    downloadLink.style.display = 'none';

    try {
        const inputFileName = 'inputVideo'; // Temporary name in ffmpeg's virtual file system
        const outputFileName = 'output.gif';

        // 1. Write the video file to FFmpeg's virtual file system
        ffmpeg.FS('writeFile', inputFileName, await fetchFile(selectedFile));
        statusMessage.textContent = 'Video loaded into memory. Preparing command...';

        // 2. Get conversion options
        const startTime = parseFloat(startTimeInput.value) || 0;
        const duration = parseFloat(durationInput.value) || 0; // 0 for full after start
        const fps = parseInt(fpsInput.value) || 10;
        const scaleWidth = parseInt(scaleWidthInput.value) || 320;

        // 3. Construct FFmpeg command arguments
        const ffmpegArgs = [];
        if (startTime > 0) {
            ffmpegArgs.push('-ss', startTime.toString());
        }
        ffmpegArgs.push('-i', inputFileName);
        if (duration > 0) {
            ffmpegArgs.push('-t', duration.toString());
        }

        // For good quality GIFs, we use a two-pass approach:
        // 1. Generate a palette from the video segment.
        // 2. Use that palette to create the GIF.
        // vf = video filtergraph
        // scale=${scaleWidth}:-1  (scale width to X, maintain aspect ratio for height)
        // flags=lanczos (high quality scaling algorithm)
        // split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse (standard palette generation technique)
        ffmpegArgs.push(
            '-vf', `fps=${fps},scale=${scaleWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
            '-loop', '0', // 0 for infinite loop, -1 for no loop, N for N loops
            outputFileName
        );

        statusMessage.textContent = 'Running FFmpeg command... This may take a while.';
        console.log('FFmpeg command:', ['ffmpeg', ...ffmpegArgs].join(' '));


        // 4. Run the FFmpeg command
        await ffmpeg.run(...ffmpegArgs);
        statusMessage.textContent = 'Conversion successful! Reading GIF...';

        // 5. Read the resulting GIF file
        const data = ffmpeg.FS('readFile', outputFileName);

        // 6. Create a Blob URL and display/offer download
        const gifUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'image/gif' }));

        gifPreview.src = gifUrl;
        gifPreview.style.display = 'block';

        downloadLink.href = gifUrl;
        downloadLink.download = `${selectedFile.name.split('.')[0]}_animated.gif`;
        downloadLink.style.display = 'block';

        statusMessage.textContent = 'GIF generated successfully!';

        // Clean up virtual files (optional, as new runs will overwrite)
        // ffmpeg.FS('unlink', inputFileName);
        // ffmpeg.FS('unlink', outputFileName);

    } catch (error) {
        console.error('Error during conversion:', error);
        statusMessage.textContent = `Error: ${error.message || 'Conversion failed. Check console.'}`;
        alert(`An error occurred: ${error.message || 'Unknown error'}`);
    } finally {
        convertToGifButton.disabled = false;
        if (selectedFile) convertToGifButton.disabled = false; // Re-enable if file still selected
        progressBar.style.display = 'none';
    }
});

// Initial check to load FFmpeg if needed or just set status
window.addEventListener('load', async () => {
    statusMessage.textContent = 'Ready. Select a video or FFmpeg will load on first conversion.';
    // You can uncomment the next line to pre-load FFmpeg on page load
    // await initFFmpeg();
});