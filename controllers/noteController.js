const Note = require("../models/model.note");
const { cloudinary } = require("../config/cloudinary");
const { processAudioWithAI } = require("../utils/audioProcessor");



exports.uploadAudio = async (req, res) => {

  try {


    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an audio file' });
    }




    const { title, category } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID not found from token' });
    }
    const filePath = req.file.path;





    const newNote = new Note({
      userId,
      title: title || 'Untitled Recording',
      category: category || 'Meeting',
      status: 'processing'
    });




    await newNote.save();








    res.status(202).json({
      message: 'Audio upload received. Processing started in background.',
      noteId: newNote._id,
      status: 'processing'
    });






    // upload cloudinary 

    cloudinary.uploader.upload(
      filePath,
      { resource_type: 'video', folder: 'voicemind_audios' },
      async (error, result) => {
        const audioUrl = result ? result.secure_url : '';
        processAudioWithAI(filePath, newNote._id, Note, audioUrl, req.user.id);
      }
    );





  }
  catch (err) {
    console.error('Upload initiation error:', err);
    res.status(500).json({ error: 'Failed to initiate audio upload process' });
  }

};














// ২. সকল নোট গেট করা
exports.getAllNotes = async (req, res) => {
  try {


    const userId = req.user.id;




    // ১. Query params থেকে page, limit এবং search বের করা
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;





    let query = { userId };


    if (category && category !== 'All') {
      query.category = category;
    }




    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }






    const totalNotes = await Note.countDocuments(query);


    const notes = await Note.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();





    const formattedNotes = notes.map(note => ({
      ...note,
      duration: note.duration || 0 // duration ফিল্ড রেসপন্সে পাঠাল
    }));






    // ৬. পেজিনেটেড রেসপন্স পাঠানো
    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(totalNotes / limit),
      totalNotes,
      hasMore: page * limit < totalNotes,
      notes: formattedNotes
    });









  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};







// ৩. সিঙ্গেল নোটের ডিটেইলস গেট করা
exports.getNoteDetails = async (req, res) => {

  try {

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Note ID is required"
      });
    }


    const note = await Note.findOne({ _id: id, userId: req.user.id });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }




    return res.status(200).json({
      success: true,
      message: "Data return success",
      data: note
    });




  }

  catch (error) {
    console.error("Error fetching note details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching note details",
      error: error.message
    });
  }



};









// ৩. সিঙ্গেল নোটের ডিটেইলস গেট করা
exports.getNoteById = async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (err) {
    console.log('Error fetching note detail:', err);
    res.status(500).json({ error: 'Server error fetching note by id' });
  }
};

















// note title rename / update

exports.updateNoteTitle = async (req, res) => {

  try {

    const { id } = req.params;
    const { title } = req.body;


    // ১. Validation Check
    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }




    const updatedNote = await Note.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { title: title.trim() },
      { new: true }
    );




    if (!updatedNote) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or unauthorized'
      });
    }

    // ৩. Success Response
    return res.status(200).json({
      success: true,
      message: 'Note title updated successfully',
      data: updatedNote
    });





  }
  catch (error) {
    console.error('Error updating note title:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating title',
      error: error.message
    });

  }


}














// delete controller ===========================================

exports.deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Note ID is required"
      });
    }



    const note = await Note.findOneAndDelete({ _id: id, userId: req.user.id });


    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found or unauthorized"
      });
    }



    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      data: { id: note._id }
    });


  }

  catch (error) {
    console.error("Error deleting note:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting note",
      error: error.message
    });
  }




}



















// get session by date ===================================================

exports.getSessionByDate = async (req, res) => {
  try {


    const { date, timezoneOffset } = req.query;



    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date query parameter is required (format: YYYY-MM-DD)"
      });
    }




    const pageNum = parseInt(req.query.page, 10) || 1;
    const limitNum = parseInt(req.query.limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;





    const offset = timezoneOffset || "+06:00";


    const startIsoString = `${date}T00:00:00.000${offset}`;
    const endIsoString = `${date}T23:59:59.999${offset}`;


    const startDate = new Date(startIsoString);
    const endDate = new Date(endIsoString);



    const query = {
      userId: req.user.id,
      createdAt: { $gte: startDate, $lte: endDate } // $lte দেওয়া নিরাপদ
    };



    const totalNotes = await Note.countDocuments(query);
    const notes = await Note.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);





    const totalPages = Math.ceil(totalNotes / limitNum) || 1;
    const hasMore = pageNum < totalPages;




    return res.status(200).json({
      success: true,
      currentPage: pageNum,
      totalPages: totalPages,
      totalNotes: totalNotes,
      hasMore: hasMore,
      notes: notes
    });



  } catch (error) {


    console.error("Error fetching notes by date:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching notes by date",
      error: error.message
    });


  }
};























