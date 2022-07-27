export const format = {
	time: (total, count = 3) => {
		let hours = Math.floor(total / (60 * 60));
		total -= hours * (60 * 60);
		let minutes = Math.floor(total / 60);
		total -= minutes * 60;
		let seconds = total;

		let counts = [hours, minutes, seconds];
		counts.splice(0, counts.length - count);
		return counts.map(
			value => value.toString().padStart(2, "0")
		).join(":");
	},
	shorten: (text, limit) => {
		if (text.length < limit) return text;

		return text.slice(0, limit - 3) + "...";
	}
};
export const timing = {
	setTimeoutOrImmediate: (callback, delay, ...params) => {
		if (delay <= 0) callback(...params);
		else return setTimeout(callback, delay, ...params);
	}
};
export const response = {
	mime: res => {
		const typeHeader = res.headers.get("content-type");
		if (typeHeader == null) return "";
		else return typeHeader.split(";")[0];
	}
};
export const ui = {
	smoothVisible: (showAfter, minShowTime) => {
		let showTask, lastShownTime, hideTask, visible, lastVisible;

		let callbackSelf;
		const callback = (unsmoothedVisible, rerenderTrigger) => {
			console.log("A");
			setTimeout(_ => {callbackSelf.rerender = ! callbackSelf.rerender}, 100);

			unsmoothedVisible = !!unsmoothedVisible;
			if (visible == null) {
				visible = unsmoothedVisible;
				lastVisible = visible;
				return visible;
			}
			if (visible == lastVisible) return visible;
			lastVisible = visible;

			if (unsmoothedVisible) {
				debugger
				if (showTask == null) {
					if (hideTask != null) clearTimeout(hideTask);
					showTask = setTimeout(_ => {
						debugger;
						visible = true;
						callbackSelf.rerender = true;
						lastShownTime = new Date();
					}, showAfter);
				}
			}
			else {
				debugger
				if (hideTask == null) {
					if (showTask != null) clearTimeout(showTask);
					hideTask = timing.setTimeoutOrImmediate(_ => {
						visible = false;
						callbackSelf.rerender = true;
					}, minShowTime - (new Date() - lastShownTime));
				}
			}
		};
		callback.rerender = false;
		callbackSelf = callback;
		return callback;
	}
};