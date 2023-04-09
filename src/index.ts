import { program } from 'commander'
import simpleGit from 'simple-git'
import fs from 'fs'
import { Configuration, OpenAIApi } from 'openai'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import * as path from 'path'

dotenvExpand(dotenv.config({ path: path.join(__dirname, '../.env') }))
const apiKey = process.env.OPEN_AI_KEY
const configuration = new Configuration({ apiKey })
const openai = new OpenAIApi(configuration)

program
	.version('1.0.0')
	.description(
		'CLI for generating commit messages based on changed lines in Git project',
	)

program
	.command('suggest')
	.description('Suggest commit messages based on changed lines in Git project')
	.option(
		'-p, --path <path>',
		'Path to the Git project (default: current directory)',
	)
	.option(
		'-m, --max-changes <max_changes>',
		'Maximum number of changed lines to process (default: 100)',
	)
	.action(async (options) => {
		const path = options.path || '.'
		const maxChanges = options.maxChanges || 100

		const git = simpleGit(path)
		const status = await git.status()
		const changedFiles = status.files.filter((file) => file.working_dir !== ' ')

		if (!changedFiles.length) {
			console.log('No changes found in Git project')
			return
		}

		const changedLines: Record<string, { file: string; lineNumber: number }> =
			{}

		for (const file of changedFiles) {
			const contents = fs.readFileSync(`${path}/${file.path}`, 'utf-8')
			const lines = contents.split('\n').slice(0, maxChanges)

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim()
				if (line && !changedLines[line]) {
					changedLines[line] = { file: file.path, lineNumber: i + 1 }
				}
			}
		}

		const messages = []

		for (const line of Object.keys(changedLines)) {
			try {
				const prompt = `Create git commit messages following the conventional commit convention, ensuring they are clear and concise. For each change, provide an explanation. Based on the output from craft a commit message and description. Use present tense, keep lines under 74 characters, and respond in English, change info: ${line}\nFile: ${changedLines[line].file}\nLine number: ${changedLines[line].lineNumber}\n`
				const completion = await openai.createCompletion({
					model: 'text-davinci-003',
					prompt,
				})
				const message = completion.data.choices[0].text?.trim()
				messages.push(
					`${message} (${changedLines[line].file}:${changedLines[line].lineNumber})`,
				)
			} catch (error) {
				if (error.response) {
					console.log(error.response.status)
					console.log(error.response.data)
				} else {
					console.log(error.message)
				}
			}
		}

		console.log('Commit message suggestions:')
		console.log(messages.join('\n'))
	})

program.parse(process.argv)
