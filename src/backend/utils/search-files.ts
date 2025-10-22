import path from 'path';
import fg from 'fast-glob';

type RawSearchItem = {
	path: string;
	full_file_name: string;
};

export async function searchFilesStructured(
	fileName: string,
	searchPath: string
): Promise<Array<{ file_name: string; file_path: string; relative_path: string }>> {
	const results = await searchFilesCore(fileName, searchPath);
	return results.map((r) => ({
		file_name: r.full_file_name,
		file_path: r.path,
		relative_path: path.relative(searchPath, r.path),
	}));
}

export function searchFilesInPath(fileName: string, searchPath: string): string {
	// Provide a sync-like wrapper that returns JSON string to match previous native addon API
	// We'll block using deasync-like behavior by leveraging fast-glob's sync API for simplicity
	const results = searchFilesCoreSync(fileName, searchPath);
	return JSON.stringify(results);
}

function buildCandidates(fileName: string) {
	// Escape glob special chars lightly; fast-glob treats [] and {} specially
	const escaped = fileName.replace(/[\\{}\[\]\(\)\?\+\^\$\.]/g, '\\$&');
	return [
		`**/*${escaped}*`, // contains
	];
}

async function searchFilesCore(fileName: string, searchPath: string): Promise<RawSearchItem[]> {
	const patterns = buildCandidates(fileName);
		const entries: string[] = await fg(patterns, {
		cwd: searchPath,
		absolute: true,
		onlyFiles: true,
		dot: false, // skip dotfiles
		followSymbolicLinks: true,
		ignore: ['**/incoming/**', '**/private-files/**'],
		unique: true,
		suppressErrors: true,
		// We handle case-insensitive match by filtering post-glob
	});

	const q = fileName.toLowerCase();
		return (entries as string[])
			.filter((abs: string) => path.basename(abs).toLowerCase().includes(q))
			.map((abs: string) => ({ path: abs, full_file_name: path.basename(abs) }));
}

function searchFilesCoreSync(fileName: string, searchPath: string): RawSearchItem[] {
	const patterns = buildCandidates(fileName);
		const entries: string[] = fg.sync(patterns, {
		cwd: searchPath,
		absolute: true,
		onlyFiles: true,
		dot: false,
		followSymbolicLinks: true,
		ignore: ['**/incoming/**', '**/private-files/**'],
		unique: true,
		suppressErrors: true,
	});

	const q = fileName.toLowerCase();
		return (entries as string[])
			.filter((abs: string) => path.basename(abs).toLowerCase().includes(q))
			.map((abs: string) => ({ path: abs, full_file_name: path.basename(abs) }));
}

export default {
	searchFilesInPath,
	searchFilesStructured,
};

