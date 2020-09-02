'use strict';

const http = require('http');
const path = require("path");
const express = require('express');
const fs  = require("fs");
const parse = require('csv-parser');
const pdf = require("html-pdf");
let ejs = require("ejs");
const app = express();
const fileUpload = require('express-fileupload');
const server = http.createServer(app);
const port = 9000 || process.env.PORT


app.set("view engine", "ejs");
app.use(fileUpload());
app.use(express.json())





app.get("/", function(req, res){
    res.send({"success":"Welcome to ECX-Unilag Certification System. Charles Ugbana built this!"});
})

app.post('/api/upload', function(req, res) {
    if(req.body.secret !== process.env.secret){
        return res.send({"message":"Unauthorised!"});
    }
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');  
    }
    const stringFile = req.files.sampleFile.name;
    if(stringFile.substr(stringFile.indexOf('.')) !== ".csv" || !stringFile.includes(".")){
        return res.send({"message":"Error. Please upload a .csv file"})  
    }
    var sampleFile = req.files.sampleFile,
                        file = sampleFile.name;
    fs.readdir(__dirname+"/tmp/csv/", function(err, files) {
        if (err) {
            throw err;
        } else {
            if(!files.length){
                
                sampleFile.mv( "./tmp/csv/"+file, function(err) {
                    if (err){
                        return res.status(500).send(err);}
                    else{
                        res.send({"message":"File uploaded!"});}
                });
            }else{
                for (const staleFile of files) {
                    fs.unlink(path.join("./tmp/csv/", staleFile), function(err) {
                          if (err)
                            { throw err;}
                          else{
                            sampleFile.mv( "./tmp/csv/"+file, function(err) {
                        if (err){
                            return res.status(500).send(err);}
                        else{
                            res.send({"message":"New file uploaded!"});}
                    });
                }
            })
        }}}
    })
});




app.post('/api/verification', function (req, res) {
  fs.readdir(__dirname+"/tmp/csv/", function(err, file) {
      if(!file.length){
          res.send({"message":"Service is not available now. Try again later."})
      }else{
       const results = [];
        fs.createReadStream('./tmp/csv/'+file)
        .pipe(parse())
        .on('data', (data) => results.push(data))
        .on('end', () => {
        const item = results.find(item => item.email === req.body.email);
           if(item.length !== 0){
                res.redirect("/api/generateCert/"+item.name)
           }else{
               res.send({"message":"Sorry, you are not eligible for certification."})
           }
      
     });
    }
        
  })
  
});

app.get("/api/generateCert/:username", (req, res) => {
    ejs.renderFile(path.join(__dirname, '/views/', "cert-template.ejs"), {student: req.params.username}, (err, data) => {
    if (err) {
          res.send(err);
    } else {
        let options = {
            "height": "11.25in",
            "width": "8.5in",
            "header": {
                "height": "20mm"
            },
            "footer": {
                "height": "20mm",
            },
        };
        pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
            if (err) {
                res.send({"message":"Something went wrong. Please try again."});
            } else {
                res.download(`${req.params.username}.pdf`, (err)=>{
                    if(err){
                        res.send({"message":"An error occured. Please try again."})
                    }else{
                        fs.unlink(path.join(`./${req.params.username}.pdf`), (err)=> {
                            if (err){
                              console.log(err)
                            }else{
                                console.log("Certificate deleted from server.")
                            }
                        })
                    }
                
                });
                
            }
        });
    }
});
})


// Start server
function startServer() {
  server.listen(port, function () {
    console.log('Express server listening on ', port);
  });
}

setImmediate(startServer);