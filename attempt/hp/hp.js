// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * mod/taskchain/attempt/hp/hp.js
 *
 * @package   mod-taskchain
 * @copyright 2010 Gordon Bateson <gordon.bateson@gmail.com>
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * hpTaskAttempt
 *
 * @return xxx
 */
function hpTaskAttempt() {

    /**#@+
    * values to be returned in the results form
    *
    * @var integer
    */
    this.status    = 0;
    this.redirect  = 0;
    this.penalties = 0;
    this.score     = 0;
    /**#@-*/

    /**
    * if clickreport is enabled we want to send all clicks
    *
    * @var boolean
    */
    this.sendallclicks = false;

    /**
    * if delay3 is disabled we want to send results via ajax and not change browser page
    *
    * @var boolean TRUE=send final results via ajax; FALSE=send final results via HTTP form
    */
    this.ajax = false;

    /**
    * array of question objects
    *
    * @var array
    */
    this.questions = new Array();

    this.quiztype  = '';    // JCloze JCross JMatch JMix JQuiz
    this.form      = null;  // reference to document.forms['store']
    this.starttime = null;  // Date object for start time as recorded by client
    this.endtime   = null;  // Date object for end time as recorded by client
    this.evt       = 0;     // most recent quiz event (see EVENT_xxx constants below)

    /**#@+
    * constants for STATUS values
    *
    * @var integer
    */
    this.STATUS_NONE        = 0;
    this.STATUS_INPROGRESS  = 1;
    this.STATUS_TIMEDOUT    = 2;
    this.STATUS_ABANDONED   = 3;
    this.STATUS_COMPLETED   = 4;
    /**#@-*/

    /**#@+
    * constants for FLAG values
    *
    * @var integer
    */
    this.FLAG_SETVALUES  = -1;
    this.FLAG_SETANDSEND =  0;
    this.FLAG_SENDVALUES =  1;
    /**#@-*/

    /**#@+
    * constants for end-of-quiz EVENT values
    *
    * @var integer
    */
    this.EVENT_TIMEDOUT   = 11; // timer has finished
    this.EVENT_ABANDONED  = 12; // STOP button
    this.EVENT_COMPLETED  = 13; // normal completion (set and send form)
    this.EVENT_SETVALUES  = 14; // normal completion (set values in form)
    this.EVENT_SENDVALUES = 15; // normal completion (send values in form)
    /**#@-*/

    /**#@+
    * constants for navigation EVENT values
    *
    * @var integer
    */
    this.EVENT_BEFOREUNLOAD = 21;
    this.EVENT_PAGEHIDE     = 22;
    this.EVENT_UNLOAD       = 23;

    /**#@+
    * constants for button EVENT values
    *
    * @var integer
    */
    this.EVENT_EMPTY = 0;
    this.EVENT_CHECK = 31;
    this.EVENT_HINT  = 32;
    this.EVENT_CLUE  = 33;
    this.EVENT_SHOW  = 34;
    /**#@-*/

    /**#@+
    * constants for input event values
    *
    * @var integer
    */
    this.EVENT_FOCUS     = 41;
    this.EVENT_KEYDOWN   = 42;
    this.EVENT_MOUSEDOWN = 43;
    /**#@-*/

    /**
     * init
     *
     * @param integer questionCount number of questions in this HP quiz
     * @param boolean sendallclicks if clickreport is enabled then TRUE; otherwise FALSE
     * @param boolean ajax       if delay3 is disabled then TRUE; otherwise FALSE
     */
    this.init = function (questionCount, sendallclicks, ajax) {
        this.form = this.findForm('store', self);
        if (questionCount) {
            this.initQuestions(questionCount);
        }
        this.sendallclicks = sendallclicks;
        this.ajax = ajax;
        this.starttime = new Date();
        this.status = this.STATUS_INPROGRESS;
    };

    /**
     * initQuestions
     *
     * @param xxx questionCount
     */
    this.initQuestions = function (questionCount) {
        for (var i=0; i<questionCount; i++) {
            this.addQuestion(i);
            this.initQuestion(i);
        }
    };

    /**
     * initQuestion
     *
     * @param xxx i
     */
    this.initQuestion = function (i) {
        // this function will be "overloaded" by subclass
    };

    /**
     * addQuestion
     *
     * @param xxx i
     */
    this.addQuestion = function (i) {
        this.questions[i] = new hpQuestion();
    };

    /**
     * onclickClue
     *
     * @param xxx i
     */
    this.onclickClue = function (i) {
        this.questions[i].clues++;
        HP_send_results(this.EVENT_CLUE);
    };

    /**
     * onclickHint
     *
     * @param xxx i
     */
    this.onclickHint = function (i) {
        this.questions[i].hints++;
        HP_send_results(this.EVENT_HINT);
    };

    /**
     * onclickCheck
     *
     * @param xxx setScores
     */
    this.onclickCheck = function (setScores) {
        // this function will be "overloaded" by subclass
    };

    /**
     * addFields
     *
     * @param xxx xml
     */
    this.addFields = function (xml) {
        // looop through fields in this attempt
        for (var fieldname in this) {
            switch (fieldname) {
                case 'status':
                case 'penalties':
                case 'score':
                    xml.addField(this.quiztype+'_'+fieldname, this[fieldname]);
                    break;

                case 'questions':
                    var keys = object_keys(this.questions, 1); // 1 = properties only
                    var x;
                    while (x = keys.shift()) {
                        this.questions[x].addFields(xml, this.getQuestionPrefix(x));
                    }
                    break;
            }
        }
    };

    /**
     * getQuestionPrefix
     *
     * @param xxx i
     * @return xxx
     */
    this.getQuestionPrefix = function (i) {
        return this.quiztype + '_q' + (parseInt(i)<9 ? '0' : '') + (parseInt(i)+1) + '_';
    };

    /**
     * setQuestionScore
     *
     * @param xxx q
     */
    this.setQuestionScore = function (q) {
        this.questions[q].score = 0;
    };

    /**
     * setScoreAndPenalties
     *
     * @param xxx forceRecalculate
     */
    this.setScoreAndPenalties = function (forceRecalculate) {
        if (forceRecalculate) {
            // trigger this.onclickCheck() event to save responses and set scores
            this.onclickCheck(true);
        }
        this.score = window.Score || 0;
        this.penalties = window.Penalties || 0;
    };

    /**
     * send_results
     *
     * @param integer evt    one of the HP.EVENT_xxx contants
     * @param integer status one of the HP.STATUS_xxx contants
     * @return xxx
     */
    this.send_results = function (evt, status) {
        if (! this.form) {
            return true; // shouldn't happen !!
        }

        var flag = this.get_flag(evt);
        var ajax = this.get_ajax(evt);

        // update event and status
        this.evt = evt;
        this.status = status;

        // set form values if required
        if (flag==this.FLAG_SETVALUES || flag==this.FLAG_SETANDSEND) {

            // get end time and round down duration to exact number of seconds
            this.endtime = new Date();
            var duration = this.endtime - this.starttime;
            this.endtime.setTime(this.starttime.getTime() + duration - (duration % 1000));

            // set score for each question
            var keys = object_keys(this.questions, 1); // 1 = properties only
            var q;
            while (q = keys.shift()) {
                this.setQuestionScore(q);
            }

            // set score and penalties
            this.setScoreAndPenalties(this.navigation_event(evt));

            // create XML
            var XML = new hpXML();
            this.addFields(XML);

            // transfer results to form
            this.form.mark.value = this.score;
            this.form.detail.value = XML.getXML();
            this.form.status.value = this.status;
            this.form.starttime.value = this.getTimeString(this.starttime);
            this.form.endtime.value = this.getTimeString(this.endtime);
        }

        // send form values if required
        if (flag==this.FLAG_SENDVALUES || flag==this.FLAG_SETANDSEND) {

            // cancel the check for navigating away from this page
            HP_remove_listener(window, 'beforeunload', HP_send_results);

            if (ajax) {
                var use_asynchronous = (evt==this.EVENT_BEFOREUNLOAD ? false : true);
                this.send_results_ajax(use_asynchronous);
            } else {
                this.form.redirect.value = 1;
                this.form.submit();
            }

            if (evt==this.EVENT_COMPLETED || evt==this.EVENT_SENDVALUES) {
                this.form = null; // we don't need this any more
            } else if (ajax) {
                HP_add_listener('window', 'beforeunload', HP_send_results);
            }
        }
    };

    /**
     * get_flag
     *
     * @param integer evt on of this.EVENT_xxx constants
     * @return xxx
     */
    this.get_flag = function (evt) {
        switch (evt) {
            case this.EVENT_SETVALUES:  return this.FLAG_SETVALUES;
            case this.EVENT_SENDVALUES: return this.FLAG_SENDVALUES;
            default:                    return this.FLAG_SETANDSEND;
        }
    }

    /**
     * get_ajax
     *
     * @param integer evt on of this.EVENT_xxx constants
     * @return xxx
     */
    this.get_ajax = function (evt) {
        switch (evt) {
            case this.EVENT_SENDVALUES: return this.ajax;
            case this.EVENT_COMPLETED:  return this.ajax;
            case this.EVENT_ABANDONED:  return 0;
            case this.EVENT_TIMEDOUT:   return 0;
            default:                    return 1;
        }
    }

    /**
     * send_results_ajax
     *
     * @param boolean use_asynchrounous
     * @return xxx
     */
    this.send_results_ajax = function (use_asynchrounous) {
        // based on http://www.captain.at/howto-ajax-form-post-request.php
        if (window.HP_xmlhttp===undefined || window.HP_xmlhttp===null) {
            window.HP_xmlhttp = false;
            if (window.XMLHttpRequest) { // modern browser (incl. IE7+)
                HP_xmlhttp = new XMLHttpRequest();
            } else if (window.ActiveXObject) { // IE
                try {
                    HP_xmlhttp = new ActiveXObject("Msxml2.XMLHTTP"); // IE6
                } catch (e) {
                    try {
                        HP_xmlhttp = new ActiveXObject("Microsoft.XMLHTTP"); // IE5
                    } catch (e) {
                        HP_xmlhttp = false;
                    }
                }
            }
        }
        if (HP_xmlhttp) {
            var params = new Array();
            var i_max = this.form.elements.length;
            for (var i=0; i<i_max; i++) {
                var obj = this.form.elements[i];
                if (! obj.name) {
                    continue;
                }
                var value = this.getFormElementValue(obj);
                if (! value) {
                    continue;
                }
                params.push(obj.name + '=' + escape(value)); // encodeURI
            }
            if (use_asynchrounous) {
                HP_xmlhttp.onreadystatechange = HP_onreadystatechange;
            }
            HP_xmlhttp.open(this.form.method, this.form.action, use_asynchrounous);
            HP_xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            HP_xmlhttp.send(params.join('&'));
        }
    }

    /**
     * getFormElementValue
     *
     * @param xxx obj
     * @return xxx
     */
    this.getFormElementValue = function (obj) {
        var v = ''; // value
        var t = obj.type;
        if (t=='text' || t=='textarea' || t=='password' || t=='hidden') {
            v = obj.value;
        } else if (t=='radio' || t=='checkbox') {
            if (obj.checked) {
                v = obj.value;
            }
        } else if (t=='select-one' || t=='select-multiple') {
            var i_max = obj.options.length;
            for (var i=0; i<i_max; i++) {
                if (obj.options[i].selected) {
                    v += (v=='' ? '' : ',') + obj.options[i].value;
                }
            }
        } else if (t=='button' || t=='reset' || t=='submit') {
            // do nothing
        } else {
            // radio or checkbox groups
            var i_max = obj.length || 0;
            for (var i=0; i<i_max; i++) {
                if (obj[i].checked) {
                    v += (v=='' ? '' : ',') + obj[i].value;
                }
            }
        }
        return v;
    };

    /**
     * getTimeString
     *
     * @param xxx date
     * @return xxx
     */
    this.getTimeString = function (date) {
        if (date==null) {
            // get default Date object
            date = new Date();
        }
        // get year, month and day (yyyy-mm-dd)
        var s = date.getFullYear() + '-' + pad(date.getMonth()+1, 2) + '-' + pad(date.getDate(), 2);
        // get hours, minutes and seconds (hh:mm:ss)
        s += ' ' + pad(date.getHours(), 2) + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2);
        // get time difference (+xxxx)
        var x = date.getTimezoneOffset(); // e.g. -540
        if (typeof(x)=='number') {
            s += ' ' + (x<0 ? '+' : '-');
            x = Math.abs(x);
            s += pad(parseInt(x/60), 2) + pad(x - (parseInt(x/60)*60), 2);
        }
        return s;
    };

    /**
     * findForm
     *
     * @param xxx id
     * @param xxx w
     * @return xxx
     */
    this.findForm = function (id, w) {
        var f = w.document.forms[id];
        if (f) {
            return f;
        }
        var i_max = (w.frames ? w.frames.length : 0);
        for (var i=0; i<i_max; i++) {
            f = this.findForm(id, w.frames[i]);
            if (f) {
                return f;
            }
        }
        return null; // shouldn't happen !!
    };

    /**
     * end_of_quiz
     *
     * @param integer evt (optional, default=null)
     * @return boolean TRUE if (current) evt is end-of-quiz event; otherwise FALSE
     */
    this.end_of_quiz = function (evt) {
        if (evt==null) {
            return (this.form==null || this.evt==this.EVENT_COMPLETED || this.evt==this.EVENT_SENDVALUES);
        }
        return (evt==this.EVENT_ABANDONED || evt==this.EVENT_TIMEDOUT || evt==this.EVENT_COMPLETED || evt==this.EVENT_SETVALUES || evt==this.EVENT_SENDVALUES);
    };

    /**
     * navigation_event
     *
     * @param integer evt (optional, default=null)
     * @return boolean TRUE if (current) evt is navigation event; otherwise FALSE
     */
    this.navigation_event = function (evt) {
        if (evt==null) {
            evt = this.evt;
        }
        return (evt==this.EVENT_BEFOREUNLOAD || evt==this.EVENT_PAGEHIDE || evt==this.EVENT_UNLOAD);
    };

    /**
     * quiz_button_event
     *
     * @param integer evt (optional, default=null)
     * @return boolean TRUE if (current) evt is quiz-button event; otherwise FALSE
     */
    this.quiz_button_event = function (evt) {
        if (evt==null) {
            evt = this.evt;
        }
        return (evt==this.EVENT_CHECK || evt==this.EVENT_HINT || evt==this.EVENT_CLUE || evt==this.EVENT_SHOW || evt==this.EVENT_EMPTY);
    };

    /**
     * quiz_input_event
     *
     * @param integer evt (optional, default=null)
     * @return boolean TRUE if (current) evt is quiz-input event; otherwise FALSE
     */
    this.quiz_input_event = function (evt) {
        if (evt==null) {
            evt = this.evt;
        }
        return (evt==this.EVENT_FOCUS || evt==this.EVENT_KEYDOWN || evt==this.EVENT_MOUSEDOWN);
    };
}

/**
 * HP_onreadystatechange
 *
 * @return xxx
 */
function HP_onreadystatechange() {
    // http://www.webdeveloper.com/forum/showthread.php?t=108334
    if (! window.HP_xmlhttp) {
        return false;
    }
    if (HP_xmlhttp.readyState==4) {
        switch (HP_xmlhttp.status) {
            case 200:
                // we do not expect to get any real content on this channel
                // it is probably an error message from the server, so display it
                document.write(HP_xmlhttp.responseText);
                document.close();
                break;
            case 204:
                // the server has fulfilled the request
                // we can unset the HP_xmlhttp object
                window.HP_xmlhttp = null;
                break;
            default:
                // alert('Unexpected httpRequest.status: '+HP_xmlhttp.status);
        }
    }
}

/**
 * hpQuestion
 */
function hpQuestion() {
    this.name      = '';
    this.type      = '';
    this.text      = '';

    this.score     = 0;
    this.weighting = 0;
    this.hints     = 0;
    this.clues     = 0;
    this.checks    = 0;
    this.correct   = new Array();
    this.wrong     = new Array();
    this.ignored   = new Array();

    /**
     * addFields
     *
     * @param xxx xml
     * @param xxx prefix
     */
    this.addFields = function (xml, prefix) {
        // add fields for this question
        for (var fieldname in this) {
            switch (fieldname) {
                case 'name':
                case 'type':
                case 'text':
                case 'score':
                case 'weighting':
                case 'hints':
                case 'clues':
                case 'checks':
                case 'correct':
                case 'wrong':
                case 'ignored':
                    xml.addField(prefix+fieldname, this[fieldname]);
                    break;
            }
        }
    }
};

/**
 * hpXML
 *
 * @return xxx
 */
function hpXML() {
    this.xml = '';
    this.fields = new Array();

    /**
     * addField
     *
     * @param xxx name
     * @param xxx value
     */
    this.addField = function (name, value) {
        this.fields[this.fields.length] = new hpField(name, value);
    }

    /**
     * getXML
     *
     * @return xxx
     */
    this.getXML = function () {
        this.xml = '<'+'?xml version="1.0"?'+'>\n';
        this.xml += '<hpjsresult><fields>\n';
        for (var i=0; i<this.fields.length; i++) {
            this.xml += this.fields[i].getXML();
        }
        this.xml += '</fields></hpjsresult>\n';
        return this.xml;
    }
};

/**
 * hpField
 *
 * @param xxx name
 * @param xxx value
 * @return xxx
 */
function hpField(name, value) {
    this.name = name;
    this.value = value;
    this.data = ''; // xml field data (i.e. "value" encoded for XML)

    /**
     * getXML
     *
     * @return xxx
     */
    this.getXML = function () {
        this.data = '';
        switch (typeof(this.value)) {
            case 'string':
                this.data += this.encode_entities(this.value);
                break;

            case 'object': // array
                var i_max = this.value.length;
                for (var i=0; i<i_max; i++) {
                    var v = trim(this.value[i]);
                    if (v.length) {
                        this.data += (i==0 ? '' : ',') +  this.encode_entities(v);
                    }
                }
                break;

            case 'number':
                this.data = ('' + this.value);
                break;
        }
        if (this.data.length==0) {
            return '';
        } else {
            if (this.data.indexOf('<')>=0 && this.data.indexOf('>')>=0) {
                this.data = '<' + '![CDATA[' + this.data + ']]' + '>';
            }
            return '<field><fieldname>' + this.name + '</fieldname><fielddata>' + this.data + '</fielddata></field>\n';
        }
    }

    /**
     * encode_entities
     *
     * @param xxx s_in
     * @return xxx
     */
    this.encode_entities = function (s_in) {
        var i_max = (s_in) ? s_in.length : 0;
        var s_out = '';
        for (var i=0; i<i_max; i++) {
            var c = s_in.charCodeAt(i);
            // 34 : double quote .......["] &quot;
            // 38 : ampersand ..........[&] &amp;
            // 39 : single quote .......['] &apos;
            // 43 : plus sign ..........[+]
            // 44 : comma ..............[,]
            // 60 : left angle bracket .[<] &lt;
            // 62 : right angle bracket [>] &gt;
            // >=128 multibyte character
            if (c==38 || c==43 || c==44 || c>=128) {
                // encode ampersand, plus sign, comma and multibyte chars
                s_out += '&#x' + pad(c.toString(16), 4) + ';';
            } else {
                s_out += s_in.charAt(i);
            }
        }
        return s_out;
    }
};

///////////////////////////////////////////
// handle quiz events and send results
///////////////////////////////////////////

/**
 * HP_send_results
 *
 * @param integer evt one of the HP.EVENT_xxx contants
 * @return boolean
 */
function HP_send_results(evt) {
    if (evt==null || window.HP==null) {
        return ''; // shouldn't happen !!
    }

    // extract and convert event type, if necessary
    if (typeof(evt)=='object') {
        evt = (evt.type ? evt.type.toUpperCase() : '');
        evt = (HP['EVENT_' + evt] || HP.EVENT_EMPTY);
    }

    // default status
    var status = HP.STATUS_NONE;

    // default action is not to send results
    var send_results = false;

    switch (true) {

        case HP.end_of_quiz():
            // quiz is already finished
            break;

        case HP.end_of_quiz(evt):
            // quiz has just finished
            send_results = true;
            switch (evt) {
                case HP.EVENT_TIMEDOUT:   status = HP.STATUS_TIMEDOUT;  break;
                case HP.EVENT_ABANDONED:  status = HP.STATUS_ABANDONED; break;
                case HP.EVENT_COMPLETED:  status = HP.STATUS_COMPLETED; break;
                case HP.EVENT_SETVALUES:  status = HP.STATUS_COMPLETED; break;
                case HP.EVENT_SENDVALUES: status = HP.STATUS_COMPLETED; break;
            }
            break;

        case HP.navigation_event(evt) && (HP.quiz_input_event() || HP.quiz_button_event()):
            // navigation event, following a button or input event
            // we need to set status to ABANDONED, because this may be our last chance
            send_results = true;
            status = HP.STATUS_ABANDONED;
            break;

        case (HP.quiz_input_event(evt) || HP.quiz_button_event(evt)) && HP.navigation_event():
            // button or input event, following a navigation event
            // we need to set status to INPROGRESS, in case it was set to ABANDONED above
            send_results = true;
            status = HP.STATUS_INPROGRESS;
            break;

        case HP.sendallclicks && HP.quiz_button_event(evt):
            // send all button events for the "click report"
            send_results = true;
            status = HP.STATUS_INPROGRESS;
            break;
    }

    if (send_results) {
        HP.send_results(evt, status);
    }

    if (evt==HP.EVENT_BEFOREUNLOAD && window.HP_beforeunload) {
        return HP_beforeunload();
    } else {
        return evt;
    }
};
