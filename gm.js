let fs = require('fs');
let path = require('path');
let _ = require('underscore');
let ejs = require('ejs');
let colors = require('colors');
/**
 * load args
 * @type Object
 */
let CONSOLE_HEAD = '[GM]'.green;
let argv = require("argp").createParser({
		once: true
	})
	.description("Gm help.")
	.email("wyyxdgm@163.com")
	.body()
	//The object and argument definitions and the text of the --help message
	//are configured at the same time
	// .text(" Arguments:")
	// .argument("path", {
	// 	description: "Path of the target file that will be bulilded, default value is defined in gm.json by the 'main' property"
	// })
	.text("\n Options:")
	.option({
		short: "d",
		long: "directory",
		optional: true,
		metavar: "DIR",
		description: "The directory to be builded, default is current directory"
	})
	.option({
		short: "a",
		long: "append-array",
		description: "Appends intead of replaces an array"
	})
	.option({
		short: "V",
		long: "verbose",
		description: "Makes output more verbose"
	})
	.help()
	.version("v1.0.0")
	.argv();

let baseDir = argv.directory ? path.resolve(process.cwd(), argv.directory) : process.cwd();
let verbose = argv.verbose;

let _require = (path_name_no_suffix) => {
	if (verbose) console.log(CONSOLE_HEAD, 'Load'.yellow, path.relative(baseDir, path_name_no_suffix));
	let json;
	try {
		json = require(path_name_no_suffix);
	} catch (e) {
		console.error(`no ${path_name_no_suffix} with suffix .json nor .js`);
	}
	return json;
}
let loadHJ = (baseDir) => {
	if (!fs.existsSync(path.join(baseDir, 'gm.json'))) return console.error('no gm.json');
	let conf = require(path.join(baseDir, './gm.json'));
	if (!conf.main) return console.error('no main gm.json');
	let [htmlPath, jsonPath] = [conf.main + '.html', conf.main].map(_p => path.join(baseDir, _p));
	if (!fs.existsSync(htmlPath)) return console.error('no file ' + htmlPath + ' that defined in gm.json by main');
	if (!_require(jsonPath)) return console.error('wich is defined in gm.json by main!');
	let htmlContent = fs.readFileSync(htmlPath).toString()
	let json = _require(jsonPath);
	// console.log("load======", baseDir, {
	// 	htmlContent,
	// 	json
	// })
	return {
		htmlContent,
		json,
		conf
	};
}

if (verbose) console.log(CONSOLE_HEAD, `BuildDirectory: ${baseDir}`)
/**
 * init htmlContent,json,conf
 */
let {
	htmlContent,
	json,
	conf
} = loadHJ(baseDir);


/**
 * init gmComponents by load gm_components
 * @type {}
 */
let gmComponents = {};
let gmComponentsDirs = fs.readdirSync(path.join(baseDir, 'gm_components'));
gmComponentsDirs.forEach((moduleDir) => {
	let _p = path.join(baseDir, 'gm_components', moduleDir);
	gmComponents[moduleDir] = loadHJ(_p);
});

/**
 * build
 * @return {string} build html
 */
let build = () => {

	let resolveKey = (o, k) => {
		let v = o[k];
		if (_.isObject(v) && v.template) { //template
			let moduleComponent = gmComponents[v.template];
			let data = deepExtend(true, moduleComponent.json, v.data);
			for (key in data) {
				data[key] = resolveKey(data, key);
			}
			if (verbose) console.log(`[GM] Render: ${v.template}`);
			// console.log(`ejs.render: ${v.template}`)
			// console.log(v.template);
			// console.log('- - - - - - - - - - - - ')
			// console.log(data);
			// console.log('========================')

			return ejs.render(moduleComponent.htmlContent, data);
		} else if (_.isArray(v)) {
			// console.log('isArray====================', v)
			return _.map(v, e => resolveKey({
				k: e
			}, 'k'));
		} else {
			return v;
		}
	}
	for (key in json) {
		json[key] = resolveKey(json, key);
	}
	let htmlStr = ejs.render(htmlContent, json);
	return htmlStr;
}
let htmlStr = build();
fs.writeFileSync(path.join(baseDir, conf.output || 'gm.html'), htmlStr);

//bower
// cache                   Manage bower cache
//     help                    Display help information about Bower
//     home                    Opens a package homepage into your favorite browser
//     info                    Info of a particular package
//     init                    Interactively create a bower.json file
//     install                 Install a package locally
//     link                    Symlink a package folder
//     list                    List local packages - and possible updates
//     login                   Authenticate with GitHub and store credentials
//     lookup                  Look up a single package URL by name
//     prune                   Removes local extraneous packages
//     register                Register a package
//     search                  Search for packages by name
//     update                  Update a local package
//     uninstall               Remove a local package
//     unregister              Remove a package from the registry
//     version                 Bump a package version
// Options:

//     -f, --force             Makes various commands more forceful
//     -j, --json              Output consumable JSON
//     -l, --loglevel          What level of logs to report
//     -o, --offline           Do not hit the network
//     -q, --quiet             Only output important information
//     -s, --silent            Do not output anything, besides errors
//     -V, --verbose           Makes output more verbose
//     --allow-root            Allows running commands as root
//     -v, --version           Output Bower version
//     --no-color              Disable colors
//     --config.interactive=false Disable prompts


/**
 *
 * 构建当前页面的json。
 * [0]for key
 * 	[1]如果是template,
 * 		读取该tempate,路径：相对当前路径
 * 			读取的数据
 * 				如果原来没有data数据，
 * 					拼接到该json的data上
 * 						回到[0]
 * 				如果原来的有数据，进入下一层
 * 					回到[1]
 * 
 * 		如果是别的直接忽略。
 * PRE: 所有的 template 都在 gm_components 下
 */

function deepExtend() {
	//  arguments种类
	//  [deep]  可选，标注是否为深度继承
	//  target  第一个对象，则为目标对像
	//  options  之后的对象，都视为继承对象
	var args = arguments,
		target = args[0], //  假设第一个参数为目标对象
		len = args.length, //  获取参数总长度
		i = 1, //  假设继承对象从下标为1开始
		deep = false, //  初始化为浅拷贝
		tar, source, option, key
	//  如果第一个参数是布尔值，那么第二个参数做为目标对象
	if (typeof target === 'boolean') {
		deep = target
		target = args[i++]
	}
	//  遍历继承对象，并将每一个都继承到目标对象中
	for (; i < len; i++) {

		option = args[i]

		for (key in option) {
			tar = target[key]
			source = option[key]
			// console.log("source", source, "option", option, "key", key)
			//  如果为深拷贝并且此时的属性值为对象，则进行递归拷贝
			if (deep && _.isObject(source)) {
				if (!_.isObject(tar)) { //  如果目标对象没有此属性，那么创建它
					tar = _.isArray(source) ? [] : {}
				}
				if (_.isArray(tar) && _.isArray(source) && !argv['append-array']) {
					let _st = source.length > tar.length
					if (_st > 0) source.splice(_st);
				}
				//  将递归拷贝的结果赋值给目标对象
				target[key] = deepExtend(deep, tar, source);
			} else {
				//  如果为浅拷贝，直接赋值
				target[key] = source
			}
		}
	}
	return target
}