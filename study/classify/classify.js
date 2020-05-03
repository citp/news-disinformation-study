const fs = require('fs');
const sng = require('simplengrams');
const parse = require('csv-parse/lib/sync')

const CovidLinearSVC = function(model_data) {
    // Read model data exported from Python (sklearn)
    this.feature_labels = model_data['features']
    this.coefficients = [model_data['class0_coefs'].split(',').map(i => {return parseFloat(i);}),
                         model_data['class1_coefs'].split(',').map(i => {return parseFloat(i);}),
                         model_data['class2_coefs'].split(',').map(i => {return parseFloat(i);})];
    this.intercepts = [parseFloat(model_data['class0_intercept']),
                       parseFloat(model_data['class1_intercept']),
                       parseFloat(model_data['class2_intercept'])]
    this.tokenization_params = {'title': model_data['title_tokenization_params'],
                                'content': model_data['content_tokenization_params'],
                                'url': model_data['url_tokenization_params']}
    this.idf_vector = model_data['idf_vector'];

    // Produce arrays of tokens for article titles and content:
    this.tokenizeText = function(text) {
        t = text.replace(/\'|\’/g, "")  // Remove apostrophes
        t = t.replace(/[^A-Za-z0-9]+/g, " ") // Replace non-alphanum chars with spaces
        t = t.toLowerCase() // Lowercase all letters
        t = t.split(" ") // Create array
        return t
    }

    // Tokenize text and return an array of all ngrams
    this.preprocessPage = function(title, content, url) {
        var ngrams = [];

        // Tokenize the title, adding the title__ prefix to each token
        var tokens = this.tokenizeText(title).map(token => "title__"+token).join(" ");

        // Parse the range of ngrams to generate from the loaded params, then generate ngrams
        var ngram_range = this.tokenization_params['title']['ngram_range'].split(/\D/g).filter(i => {
            if (i != ''){
                return i;
            }
        });
        for (var i = Number(ngram_range[0]); i <= Number(ngram_range[1]); i++) {
            ngrams = ngrams.concat(sng.ngramsSync(tokens,i).map(t => t.join(" ")).flat());
        }

        // Tokenize the content, adding the content__ prefix to each token
        tokens = this.tokenizeText(content).map(token => "content__"+token).join(" ");

        // Parse the range of ngrams to generate from the loaded params, then generate ngrams
        ngram_range = this.tokenization_params['content']['ngram_range'].split(/\D/g).filter(i => {
            if (i != ''){
                return i;
            }
        });
        for (var i = Number(ngram_range[0]); i <= Number(ngram_range[1]); i++) {
            ngrams = ngrams.concat(sng.ngramsSync(tokens,i).map(t => t.join(" ")).flat());
        }

        // Tokenize the URL:
        // 1. Parse the pathname, split it on a custom regex, and drop empty tokens
        // 2. Lowercase all characters and add the URL__ prefix  
        const url_regex = /htm|html|\/|-|_|\.|\?|=|\b[0-9]+\b/ig
        tokens = new URL(url).pathname.split(url_regex).filter(t => {
            if (t != ''){
                return i;
            }
        }).map(token => "URL__"+token.toLowerCase()).join(" ");

        // Parse the range of ngrams to generate from the loaded params, then generate ngrams
        ngram_range = this.tokenization_params['url']['ngram_range'].split(/\D/g).filter(i => {
            if (i != ''){
                return i;
            }
        });
        for (var i = Number(ngram_range[0]); i <= Number(ngram_range[1]); i++) {
            ngrams = ngrams.concat(sng.ngramsSync(tokens,i).map(t => t.join(" ")).flat());
        }

        return ngrams;
    };

    // Compute the frequency of each ngram in an array
    this.computeNgramCounts = function(ngrams){
        ngrams = ngrams.filter(n => this.feature_labels.includes(n));
        const ngram_counts = ngrams.reduce(function (acc, curr) {
            if (typeof acc[curr] == 'undefined') {
                acc[curr] = 1;
            } else {
                acc[curr] += 1;
            }

            return acc;
        }, {})
        return ngram_counts
    }

    // Create the feature count array using the ngram counts and adding 0-counts for all features not present
    this.computeFeatureCounts = function(ngram_counts){
        return this.feature_labels.map(label => {
            if (typeof ngram_counts[label] == 'undefined'){
                return 0;
            } else {
                return ngram_counts[label];
            }
        });
    }

    // Produce a normalized TF-IDF representation of a feature count array
    this.applyTFIDF = function(feature_counts){

        // Compute the frequency of each term and multiple by the corpus IDF
        const num_terms = feature_counts.reduce((acc, count) => acc + count)
        const idf_features = feature_counts.map((curr,index) => {
            return((curr/num_terms) * this.idf_vector[index]);
        })

        // Normalize the TF-IDF representation to an L2 norm of 1
        const l2norm = Math.sqrt(idf_features.reduce((sum, x) => sum + Math.pow(x,2)))
        return idf_features.map((x) => x/l2norm)      
    }

    // Given a preprocessed page, generate the feature array for prediction
    this.generateFeatures = function(ngrams) {       
        return applyTFIDF(computeFeatureCounts(computeNgramCounts(ngrams)));
    };

    // Predict on a set of features
    // Automatically generated by sklearn-porter
    this.predict = function(features) {
        var classIdx = 0,
            classVal = Number.NEGATIVE_INFINITY,
            prob = 0.;
        for (var i = 0, il = this.intercepts.length; i < il; i++) {
            prob = 0.;
            for (var j = 0, jl = this.coefficients[0].length; j < jl; j++) {
                prob += this.coefficients[i][j] * features[j];
            }
            if (prob + this.intercepts[i] > classVal) {
                classVal = prob + this.intercepts[i];
                classIdx = i;
            }
        }
        return classIdx;
    };

};

function loadTestData(){
    const csv_content = fs.readFileSync('clf_test_domains.csv', {encoding: 'utf8'});
    const csv_rows = parse(csv_content,{columns: true})

    var testData = {};
    for (row of csv_rows){
        const article_filename = 'articles\\'+row['id']+'.txt'
        try {
            const content = fs.readFileSync(article_filename, {encoding: 'utf8'});
            testData[row['id']] = {};

            const title = content.match(/<title>(.*)<\/title>(.*)/s)
            if (title != null){
                testData[row['id']]['title'] = title[1];
                testData[row['id']]['content'] = title[2];
            } else {
                testData[row['id']]['title'] = " ";
                testData[row['id']]['content'] = content;
            }
            testData[row['id']]['url'] = row['link'];
        } catch(err){
            console.log(`Failed on ${row['id']}`);
        }
    }
    return testData;
}

function testClassifier(testData){
    const model_data = JSON.parse(fs.readFileSync('covid-linearsvc_data.json', 'utf8'));
    const clf = new CovidLinearSVC(model_data);
    for (key of Object.keys(testData)){
        const ngrams = clf.preprocessPage(testData[key]['title'],testData[key]['content'],testData[key]['url'])
        const ngram_counts = clf.computeNgramCounts(ngrams);
        const feature_counts = clf.computeFeatureCounts(ngram_counts);
        const features = clf.applyTFIDF(feature_counts);
        const p = clf.predict(features)
        console.log(p)
    }
}

const testData = loadTestData()
testClassifier(testData)

//TODOs:
// Finalize model in Python; add any additional functionality needed here
// Make asynchronous
// Output results of preprocessing, feature generation, and classification
//   for the Python code to ingest and validate