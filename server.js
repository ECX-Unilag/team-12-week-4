const express = require('express');
const app = express();
const path = require("path");
const fs  = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const parse = require('csv-parser');
const pdf = require("html-pdf");
const ejs = require("ejs");
const flash = require("connect-flash");
const lowercaseKeys = require("lowercase-keys");
const fileUpload = require('express-fileupload');
var Jimp = require("jimp");

app.use(require("express-session")({
	secret: "Charles built this",
	resave: false,
	saveUninitialized: false
}));
app.use(cors());
app.set("view engine", "ejs");
app.use(fileUpload());
app.use(express.static(path.join(__dirname,"public")));
app.use(express.json());
app.use(flash());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(function(req, res, next){
	res.locals.error = req.flash("error");
	
	res.locals.success = req.flash("success");
	next();
});



app.get("/test", function(req, res){
    res.send({"success":"Welcome to ECX-Unilag Certification System. Charles Ugbana built this!"});
})

app.get("/admin", function(req, res){
    res.render("admin/index");
})

app.get("/", function(req, res){
    res.render("landing/index");
})
app.get("/hi", function(req, res){
    res.render("certificate/mentor");
})


app.post('/api/upload',  function(req, res) {
    if(req.body.secret !== process.env.secret){
        req.flash("error", "Unauthorised!");
        return res.redirect("/admin")
    }
    if (!req.files || Object.keys(req.files).length === 0) {
        req.flash("error", "No file was uploaded.");
        return res.redirect("/admin"); 
    }
    const stringFile = req.files.sampleFile.name;
    if(stringFile.substr(stringFile.indexOf('.')) !== ".csv" || !stringFile.includes(".")){
        req.flash("error", "Error. Please upload a .csv file");
        return res.redirect("/admin");  
    }
    var sampleFile = req.files.sampleFile,
                        file = sampleFile.name;
    fs.readdir("./tmp/csv/", function(err, files) {
        if (err) {
            req.flash("error", "Something went wrong. Please try again.");
            return res.redirect("/admin");
        } else {
            if(!files.length){
                
                sampleFile.mv( "./tmp/csv/"+file, function(err) {
                    if (err){
                        req.flash("error", "Something went wrong. Please upload again.");
                        return res.redirect("/admin");
                    }else{
                        req.flash("success", "File upload successful");
                        return res.redirect("/admin");}
                });
            }else{
                for (const staleFile of files) {
                    fs.unlink(path.join("./tmp/csv/", staleFile), function(err) {
                          if (err)
                            { req.flash("error", "Something went wrong. Please upload again.");
                            return res.redirect("/admin");}
                          else{
                            sampleFile.mv( "./tmp/csv/"+file, function(err) {
                                if (err){
                                    req.flash("error", "Something went wrong. Please try again.");
                                    return res.redirect("/admin");}
                                else{
                                    req.flash("success", "File upload successful");
                                    return res.redirect("/admin");}
                    });
                }
            })
        }}}
    })
});



app.post('/api/user/verification',  function (req, res) {
  fs.readdir("./tmp/csv/", function(err, file) {
      if(file.length === 0){
        req.flash("error", "Service is not available now. Try again later.");
        return res.redirect("/");
         
      }else{
       const results = [];
        fs.createReadStream('./tmp/csv/'+file)
        .pipe(parse())
        .on('data', (data) => results.push(data))
        .on('end', () => {
        var item = results.find(item => item.email.toLowerCase() === req.body.email.toLowerCase());
           if(item){
                item = lowercaseKeys(item)
                if(item.track !== "Mentor"){
                    return res.redirect("/api/generateCert/"+item.name +"/" + item.track)
                }else{
                    return res.redirect("/api/generateCert/"+item.name)
                }     
           }else{
            req.flash("error", "Sorry, you are not eligible for certification.");
            return res.redirect("/");
           }
      
     });

    }
        
  })
  
});

//=========================================================================
//THESE ROUTES ARE FOR RENDERING HTML FILE INTO PDF
//==============================================================================

app.get("/api/generateCert/:username/:track", (req, res) => {
    ejs.renderFile(path.join(__dirname, '/views/certificate', "index.ejs"), {student: req.params.username, 
      track: req.params.track.replace(":", "/")}, (err, data) => {
  if (err) {
        res.send(err);
  } else {
      let options = {
          "format":"A4",
          "orientation":"landscape"
          //210 297 
      };
      pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
          if (err) {
              req.flash("error", "Something went wrong. Please try again.");
              return res.redirect("/");
          } else {
              res.download(`./${req.params.username}.pdf`, (err)=>{
                  if(err){
                      req.flash("error", "Something went wrong. Please try again.");
                      return res.redirect("/");
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

app.get("/api/generateCert/:username", (req, res) => {
    ejs.renderFile(path.join(__dirname, '/views/certificate', "mentor.ejs"), {mentor: req.params.username}, (err, data) => {
  if (err) {
        res.send(err);
  } else {
      let options = {
          "height":"210mm",
          "width":"297mm",  
      };
      pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
          if (err) {
              req.flash("error", "Something went wrong. Please try again.");
              return res.redirect("/");
          } else {
              res.download(`./${req.params.username}.pdf`, (err)=>{
                  if(err){
                      req.flash("error", "Something went wrong. Please try again.");
                      return res.redirect("/");
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

/*
async function interns(name, track, callback){
    const image = await jimp.read("https://res.cloudinary.com/charlene04/image/upload/v1600532444/ecx_cert_lyetl0.jpg");
    const font = await jimp.loadFont("./fonts/Montserrat-SemiBold.ttf.fnt");
    image.print(font, 0, 0, name);
    var track1 = track.replace(":", "/")
    image.print(font, 500, 1200, track1);
    await image.write("./"+name+".png");
    callback();
    
};

function mentors(name, callback){
    //const image = await jimp.read("frame 5.jpg");
   // const width = await jimp.measureText(jimp.FONT_SANS_128_BLACK, name);
    //https://res.cloudinary.com/charlene04/image/upload/v1600616005/frame_5_woq36g.jpg
   // jimp.loadFont("./fonts/mentors/SourceSerifPro-SemiBold.ttf.fnt").then((font) => {
   //     image.print(font, (image.bitmap.width - width)/ 2, 1080, name);
   //     image.write("./"+name+".png");
   // })
   // .catch((err)=>{
   //     console.log(err.message)
   // })
   // callback();
    Jimp.read('./frame 5.jpg', (err, image) => {
        if (err) throw err;
        Jimp.loadFont("./fonts/mentors/SourceSerifPro-SemiBold.ttf.fnt", (err, font) => {
          var w = image.bitmap.width;
          var h = image.bitmap.height;
          let text =   `${name}`;
          var textWidth = Jimp.measureText(font, text);
          var textHight = Jimp.Jimp.measureTextHeight(font, text);
          image
            .print(font, w/2 - textWidth/2, 1080,
              {   
              text: text,
              //alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,                                                                                                                      
              //alignmentY: jimp.VERTICAL_ALIGN_MIDDLE,
              }, textWidth, textHight)
            .write("./"+name+".png"); // save
        }); 
        callback();
          //.resize(256, 256) // resize
          //.quality(60) // set JPEG quality
          //.greyscale() // set greyscale
      });

    
};




app.get("/api/generateCert/:username/:track", (req, res) => {
    var fullname = req.params.username.toUpperCase();
    var devtrack = req.params.track.toUpperCase();
    interns(fullname, devtrack, () =>{
        setTimeout(()=>{
            res.download(`./${fullname}.png`, (err)=>{
                if(err){
                    req.flash("error", "Something went wrong. Please try again.");
                    return res.redirect("/");
                }else{
                    fs.unlink(path.join(`./${fullname}.png`), (err)=> {
                        if (err){
                          console.log(err)
                        }else{
                            console.log("Certificate deleted from server.")
                        }
                    })
                }
            
            });
        }, 3000)
        
    })   
   
})

app.get("/api/generateCert/:username", (req, res) => {
    const fullname = req.params.username.toUpperCase();
    mentors(fullname, () => {
        setTimeout(()=>{
            res.download(`./${fullname}.png`, (err)=>{
                if(err){
                    req.flash("error", "Something went wrong. Please try again.");
                    return res.redirect("/");
                }else{
                    fs.unlink(path.join(`./${fullname}.png`), (err)=> {
                        if (err){
                          console.log(err)
                        }else{
                            console.log("Certificate deleted from server.")
                        }
                    })
                }
            })
        }, 3000)
    

        
        });
})
*/




  


app.listen(process.env.PORT || 3000, function () {
    console.log('Express server listening on ', process.env.PORT);
  });


