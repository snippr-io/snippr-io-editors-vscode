const vscode = require('vscode')
const homedir = require('os').homedir()
const path = require('path')
const fs = require('fs')

class SnippetCompletionItemProvider {
    constructor() {
        this.snipprDir = path.join(homedir, ".snippr")
        this.loadSnippets()

        fs.watch(path.join(this.snipprDir, "vscode"), {
            persistent: false,
            recursive: false,
        }, () => this.loadSnippets())
    }

    loadSnippets() {
        this.completions = {}
        this.snippetsCount = 0

        let store
        try {
            store = require(path.join(this.snipprDir, "store.json"))
        } catch(e) {
            vscode.window.showErrorMessage("There was an error loading your snippr collections store.")
            return
        }
        
        if(typeof store != 'object' || typeof store.VSCode != 'object' || Object.keys(store.VSCode).length == 0) {
            vscode.window.showWarningMessage('You currently have no snippr collections installed for Visual Studio Code.')
            return
        }

        for(const name in store.VSCode)
            this.loadSnippetCollection(name, store.VSCode[name])

        const collectionCount = Object.keys(store.VSCode).length
        const collectionWord = collectionCount == 1 ? "collection" : "collections"
        const snippetWord = this.snippetsCount == 1 ? "snippet" : "snippets"
        vscode.window.setStatusBarMessage(`Successfully loaded ${collectionCount} snippr ${collectionWord} containing ${this.snippetsCount} ${snippetWord}.`, 5000)
    }

    loadSnippetCollection(name, data) {
        let loadedHashes = []
        for(let i = 0; i < data.Snippets.length; i++) {
            const hash = data.Snippets[i].Hash
            if(loadedHashes.indexOf(hash) !== -1)
                continue
            loadedHashes.push(hash)
            const file = path.join(this.snipprDir, "vscode", `${name}-${hash}.json`)
            this.loadSnippetFile(file)
        }
    }

    loadSnippetFile(file) {
        const snippets = JSON.parse(fs.readFileSync(file))
        for(let name of Object.keys(snippets))
            this.loadSnippet(name, snippets[name])
    }

    loadSnippet(name, spec) {
        for(let i = 0; i < spec.prefix.length; i++) {
            const completionItem = new vscode.CompletionItem(name, vscode.CompletionItemKind.Snippet)
            completionItem.filterText = spec.prefix[i]
            completionItem.insertText = new vscode.SnippetString(Array.isArray(spec.body) ? spec.body.join("\n") : spec.body)
            completionItem.detail = spec.description
            completionItem.documentation = new vscode.MarkdownString().appendCodeblock(completionItem.insertText.value)

            if(!this.completions[spec.scope])
                this.completions[spec.scope] = new vscode.CompletionList()
            this.completions[spec.scope].items.push(completionItem)
        }
        this.snippetsCount++
    }

    provideCompletionItems(document, position, token) {
        return this.completions[document.languageId]
    }
}

function activate(context) {
    const provider = new SnippetCompletionItemProvider()
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: "file" }, provider))
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: "untitled" }, provider))
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}