<script>
	import { request } from "$util/Backend.js";

	let uploading = false;

    export const handleUpload = async e => {
		if (uploading) return;
        let fileInfos = e.dataTransfer.items;

        if (fileInfos) {
            let files = [];
            for (let fileInfo of fileInfos) {
                if (fileInfo.kind == "file") {
                    files.push(fileInfo.getAsFile());
                }
            }
            if (files.length != 0) {
				uploading = true;
				await request.file.upload.batch(files);
				uploading = false;
            }
        }
    };
</script>

<svelte:window on:dragover|preventDefault on:drop|preventDefault={handleUpload}></svelte:window>